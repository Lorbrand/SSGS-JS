/*

    Lorbrand Sensor Seal Gateway Server
    --------------------------------------------------------------

    Copyright (C) 2023 Lorbrand (Pty) Ltd

    https://github.com/Lorbrand/SSGS-Node#readme

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.

*/

let __SSGS_DEBUG: boolean = false;

const RECV_MSG_FIFO_MAX_LEN = 100;
const SENT_MSG_LIST_MAX_LEN = 100;
const RETRANSMISSION_COUNT_MAX = 10;
const RETRANSMISSION_TIMEOUT_MS = 2000;

import * as dgram from 'node:dgram';
import * as fs from 'node:fs/promises';

import { SSGSCP } from './ssgscp/ssgscp.js';
import { ParsedSSGSCPPacket } from './ssgscp/ssgscp.js';
import { PacketType } from './ssgscp/ssgscp.js';

import { MessageSubtype } from './ssgscp/ssprotocols.js';
import { SensorSealUpdate } from './ssgscp/ssprotocols.js';
import { ParsedMessage } from './ssgscp/ssprotocols.js';
import SSProtocols from './ssgscp/ssprotocols.js';

import { assert } from 'node:console';

type ConfigFile = {
    key: string;
    authorized_gateways: Array<{ uid: string, key: string }>;
};

type AuthorizedGateway = {
    gatewayUID: Buffer;
    key: Buffer;
};

type SentMessage = {
    packetID: number; // the packet ID of the message
    timestamp: number; // the timestamp of when the message was sent
    packet: Buffer; // the packed SSGSCP packet
    resolve: (receivedOk: boolean) => void; // the resolve function of the promise
    receivedOk: boolean; // whether the message was received ok
    retransmissionCount: number; // the number of times the message has been retransmitted
};

export type Client = { // the client state machine
    gatewayUID: Buffer; // the client (gateway) UID
    sourcePort: number; // the UDP port number the client is sending from (ephemeral port)
    remoteAddress: string; // the IP address of the client
    lastSeen: number; // the timestamp of the last time the client sent a message
    sendPacketID: number; // the packet ID of the next message to send to the client
    retransmissionTimeout: number; // the retransmission timeout in milliseconds
    sentMessages: Array<SentMessage>; // the list of sent messages
    receivedMessageIDsFIFO: Array<number>; // the list of received message IDs, needed for duplicate detection, max length is RECV_MSG_FIFO_MAX_LEN
    key: Buffer; // the encryption key
    onmessage: (update: ParsedMessage) => void; // the callback function to handle incoming messages from the gateway
    onupdate: (update: SensorSealUpdate) => void; // the callback function to handle incoming Sensor Seal updates
    onreconnect: () => void; // the callback function to handle a client reconnecting
    /**
     * @method
     * @param {Buffer} payload - the payload to send to the client
     * @returns {Promise<boolean>} - whether the message was received ok
     * Sends a MSGCONF packet to the client and returns a promise resolving to whether the message was 
     * received ok or false after it has been retransmitted RETRANSMISSION_COUNT_MAX times
     */
    send: (payload: Buffer) => Promise<boolean>; // the function to send a CONF packet to the client
}

type ssgsOptions = {
    debug?: boolean;
};

class SSGS {
    /**
     * @param {Client} client - the new authorized client that has connected
     * The callback function that is called when a new client (gateway) has connected and is authenticated
     */
    onconnection: (client: Client) => void; 

    /**
     * @param {Buffer} gatewayUID - the UID of the gateway
     * @param {string} remoteAddress - the IP address of the gateway that is attempting to connect
     * @param {number} port - the UDP source port number of the gateway that is attempting to connect
     * @returns {Buffer | null} - the key of the gateway if it should be authorized, null otherwise
     * The callback function that is called when an unauthorized gateway (not in config file) attempts to connect
     * Return the key of the gateway if it should be authorized, null otherwise
     * If this function is not set, all unauthorized gateways will be rejected
     */
    onconnectionattempt: (gatewayUID: Buffer, remoteAddress: string, port: number) => Promise<Buffer | null>;

    port: number; // the UDP port number to listen for SSGSCP packets
    configFilePath: string; // the path to the SSGS configuration file
    socket: dgram.Socket; // the UDP socket
    configFile: ConfigFile; // the configuration file object
    authorizedGateways: Array<AuthorizedGateway>; // the list of authorized gateways
    connectedClients: Array<Client>; // the list of connected clients

    /**
     * @constructor
     * @param {number} port - the UDP port number to listen for SSGSCP packets, default is 1818
     * @param {function} onmessage - the callback function to handle incoming messages
     * @param {string} configFilePath - the path to the SSGS configuration file, default is './authorized.json'
     */
    constructor(port: number = 1818, onconnection: (client: Client) => void, configFilePath?: string, options?: ssgsOptions) {
        this.port = port;
        this.onconnection = onconnection;
        this.onconnectionattempt = async (gatewayUID, remoteAddress, port) => { return null; }; // default to rejecting all unauthorized gateways
        this.configFilePath = configFilePath ?? './authorized.json';
        this.socket = null;
        this.configFile = null;
        this.authorizedGateways = [];
        this.connectedClients = [];

        if (options && options.debug) {
            console.log('SSGS: Debug mode enabled');
            __SSGS_DEBUG = true;
        }

        this.begin();
    }

    /**
     * @method
     * @async
     * Starts the SSGS server by loading the configuration file and listening for incoming messages on the specified UDP port
     */
    async begin() {
        await this.loadConfig(this.configFilePath);
        this.socket = dgram.createSocket('udp4');

        this.socket.on('error', (err) => {
            console.error('Internal SSGS Server Error:', err.message);
            this.socket.close();
        });

        this.socket.on('message', (datagram: Buffer, rinfo: dgram.RemoteInfo) => {
            this.process(datagram, rinfo);
        });

        this.socket.bind(this.port);
        setInterval(() => this.tickClients(), 200);
    }

    /**
     * @method
     * @returns {void}
     * Ticks the connected clients to check for required retransmissions
     * This function should be called periodically, e.g. every 200ms
     * Sends at most 10 retransmissions per client per tick
     */
    tickClients() {
        const now = Date.now();

        for (const client of this.connectedClients) {
            // loop over the sent messages and check if any need to be retransmitted, limit to 10 messages per client per tick
            let retransmittedCount = 0;

            for (const sentMessage of client.sentMessages) {
                if (retransmittedCount < 10 && now - sentMessage.timestamp > client.retransmissionTimeout) {
                    // retransmit the message
                    this.socket.send(sentMessage.packet, client.sourcePort, client.remoteAddress, (err) => {
                        if (err)
                            logIfSSGSDebug('Error: Could not send packet: ' + err);
                    });
                    logIfSSGSDebug('Retransmitting packet: ' + sentMessage.packetID + ', num pending: ' + client.sentMessages.length);
                    sentMessage.timestamp = Date.now();
                    sentMessage.retransmissionCount++;

                    // if the message has been retransmitted more than RETRANSMISSION_COUNT_MAX times, remove it from the list and resolve the promise to false
                    if (sentMessage.retransmissionCount > RETRANSMISSION_COUNT_MAX) {
                        sentMessage.resolve(false);
                        client.sentMessages.splice(client.sentMessages.indexOf(sentMessage), 1);
                    }

                    retransmittedCount++;
                }
            }
        }

    }


    /**
     * @method
     * @param {Client} client - the client to send the message to
     * @param {PacketType} packetType - the type of packet to send
     * @param {Buffer} payload - the payload of the packet
     * @returns {void}
     * Sends a message to the specified client
     * The message is added to the sentMessages list and will be retransmitted if no RCPTOK packet is received within the retransmission timeout
     */
    sendMSG(client: Client, packetType: PacketType, payload: Buffer): Promise<boolean> {
        const packet: ParsedSSGSCPPacket = {
            packetType,
            gatewayUID: client.gatewayUID,
            packetID: client.sendPacketID,
            payload
        };

        logIfSSGSDebug('Send to client: ' + JSON.stringify(packet));

        const packedPacket = SSGSCP.packSSGSCP(packet, client.key);
        if (!packedPacket) {
            logIfSSGSDebug('Error: Could not pack packet: ' + SSGSCP.errMsg);
            return;
        }

        this.socket.send(packedPacket, client.sourcePort, client.remoteAddress, (err) => {
            if (err) {
                logIfSSGSDebug('Error: Could not send packet: ' + err);
            }
        });

        // create a promise that will be resolved when the RCPTOK packet is received
        let resolve: (receivedOk: boolean) => void;
        const promise = new Promise<boolean>((res, rej) => {
            resolve = res;
        });

        // add the sent message to the sentMessages list
        const sentMessage: SentMessage = {
            packetID: client.sendPacketID,
            timestamp: Date.now(), // the timestamp of when the message was sent
            packet: packedPacket,
            resolve, // called when the RCPTOK packet is received
            receivedOk: false, // set to true when the RCPTOK packet is received
            retransmissionCount: 0 // the number of times the message has been retransmitted
        };

        client.sentMessages.push(sentMessage);

        // increment the packet ID
        client.sendPacketID = (client.sendPacketID + 1) % 65536;

        // if the sentMessages list is too long, remove the oldest message
        if (client.sentMessages.length > SENT_MSG_LIST_MAX_LEN) {
            client.sentMessages.shift();
        }

        // return the promise that will be resolved when the RCPTOK packet is received
        return promise;
    }

    /**
     * @method
     * @param {object} parsedPacket - the parsed packet object from SSGSCP.parseSSGSCP
     * @param {object} rinfo - the remote address information from the UDP socket
     * Processes the incoming packet and calls the onmessage callback function
     */
    async process(datagram: Buffer, rinfo: dgram.RemoteInfo) {

        const gatewayUID = SSGSCP.parsePacketGatewayUID(datagram);
        if (!gatewayUID) {
            logIfSSGSDebug('Error: Could not parse gateway UID from packet');
            return;
        }

        let callbackProvidedKey: Buffer | null = null;

        if (!this.isAuthorizedGateway(gatewayUID)) {
            logIfSSGSDebug('Connecting gateway is not authorized in config, trying onconnectionattempt callback');
            
            callbackProvidedKey = await this.onconnectionattempt(gatewayUID, rinfo.address, rinfo.port);
            if (!callbackProvidedKey) {
                logIfSSGSDebug('onconnectionattempt did not authorize gateway UID: ' + SSGS.uidToString(gatewayUID) + ' from address: ' + rinfo.address);
                this.sendCONNFAIL(rinfo, gatewayUID);
                return;
            }
              
            logIfSSGSDebug('onconnectionattempt authorized gateway UID: ' + SSGS.uidToString(gatewayUID) + ' from address: ' + rinfo.address);
        }

        const key = this.getGatewayKey(gatewayUID) || callbackProvidedKey;
        if (!key) {
            logIfSSGSDebug('Error: Could not find key for gateway UID: ' + gatewayUID);
            return;
        }

        const parsedPacket = SSGSCP.parseSSGSCP(datagram, key);

        if (!parsedPacket) { // could not parse due to authentication error or other reason
            logIfSSGSDebug('Error: Could not parse packet: ' + SSGSCP.errMsg);
            this.sendCONNFAIL(rinfo, gatewayUID);
            return;
        }

        if (!parsedPacket.authSuccess) {
            logIfSSGSDebug('Error: Could not authenticate gateway');
            this.sendCONNFAIL(rinfo, gatewayUID);
            return;
        }

        // try find the Client state machine for this gateway client (in connectedClients)
        const client = this.connectedClients.find((c) => SSGS.gatewayUIDsMatch(c.gatewayUID, parsedPacket.gatewayUID));

        // if the client is not found, this is a new connection, so we need to add it to the connectedClients list
        if (!client) {
            if (parsedPacket.packetType === PacketType.CONN) {
                this.sendCONNACPT(rinfo, Buffer.from(key), parsedPacket.gatewayUID);
                const client: Client = {
                    gatewayUID: parsedPacket.gatewayUID,
                    sourcePort: rinfo.port,
                    remoteAddress: rinfo.address,
                    lastSeen: Date.now(),
                    sendPacketID: 0,
                    retransmissionTimeout: RETRANSMISSION_TIMEOUT_MS,
                    sentMessages: [],
                    receivedMessageIDsFIFO: [],
                    key: Buffer.from(key),
                    onmessage: (parsedMessage: ParsedMessage) => { },
                    onupdate: (parsedUpdate: SensorSealUpdate) => { },
                    onreconnect: () => { },
                    send: async (payload: Buffer) => {
                        return await this.sendMSG(client, PacketType.MSGCONF, payload);
                    }
                };

                this.connectedClients.push(client);

                this.onconnection(client);
                return;
            } else {
                logIfSSGSDebug('Error: Client not found in connectedClients and packet type is not CONN');
                this.sendCONNFAIL(rinfo, parsedPacket.gatewayUID);
                return;
            }
        }

        client.lastSeen = Date.now();

        switch (parsedPacket.packetType) {
            // CONNACPT is sent by the server to the client to indicate that the CONN packet was received
            case PacketType.CONN: {
                // we already have a client state machine but receivinng this could mean that the client restarted,
                // so we need to reset part of the state machine
                client.sendPacketID = 0;
                client.retransmissionTimeout = RETRANSMISSION_TIMEOUT_MS; // assume RTT is 2000 ms for now
                client.sentMessages = [];
                client.receivedMessageIDsFIFO = [];
                client.remoteAddress = rinfo.address;
                client.sourcePort = rinfo.port;

                logIfSSGSDebug('Warning: Received CONN packet from already connected client, assuming client restarted');

                // send CONNACPT to client to indicate that we received the packet
                this.sendCONNACPT(rinfo, Buffer.from(key), parsedPacket.gatewayUID);

                setTimeout(() => {
                    client.onreconnect();
                }, client.retransmissionTimeout);

                return;
            }

            // RCPTOK is sent by the client or server to indicate that a packet was received correctly
            case PacketType.RCPTOK: {
                // packet we sent was received correctly by the client, so we can remove it from the sentMessages list
                const sentMessage = client.sentMessages.find((m) => m.packetID === parsedPacket.packetID);

                // resolve the promise that was returned by the sendMSG function
                sentMessage.resolve(true);

                // set the receivedOk flag to true
                sentMessage.receivedOk = true;

                if (sentMessage) {
                    const index = client.sentMessages.indexOf(sentMessage);
                    client.sentMessages.splice(index, 1);
                } else {
                    logIfSSGSDebug('Warning: Received RCPTOK for packet ID ' + parsedPacket.packetID + ' but could not find it in sentMessages');
                }

                return;
            }

            // MSGSTATUS is sent by the client to the server 
            case PacketType.MSGSTATUS: {
                // check for duplicate packet ID in FIFO and ignore if found, otherwise add to FIFO
                if (client.receivedMessageIDsFIFO.includes(parsedPacket.packetID)) {
                    logIfSSGSDebug('Warning: Received duplicate MSGSTATUS packet ID ' + parsedPacket.packetID);

                    // send RCPTOK to client to indicate that we received the packet
                    this.sendRCPTOK(parsedPacket.packetID, rinfo, Buffer.from(key), parsedPacket.gatewayUID);

                    return;
                } else {
                    client.receivedMessageIDsFIFO.push(parsedPacket.packetID);
                    if (client.receivedMessageIDsFIFO.length > RECV_MSG_FIFO_MAX_LEN) {
                        client.receivedMessageIDsFIFO.shift(); // remove the oldest packet ID, shift left
                    }
                }

                // send RCPTOK to client to indicate that we received the packet
                this.sendRCPTOK(parsedPacket.packetID, rinfo, Buffer.from(key), parsedPacket.gatewayUID);

                // try parse from a variety of SSGSCP MSG payload formats
                const parsedMessage = SSProtocols.parse(parsedPacket);

                if (!parsedMessage) {
                    logIfSSGSDebug('Error: Could not parse message');
                    return;
                }

                client.onmessage(parsedMessage);

                if (parsedMessage.messageType === MessageSubtype.SSRB_UPDATE) {
                    client.onupdate(<SensorSealUpdate>parsedMessage.data);
                }

                return;
            }


            // outbound server->gateway packet types (should never be received by server)
            case PacketType.MSGCONF: {
                logIfSSGSDebug('Error: Server received outbound server packet: ' + parsedPacket.packetType);
                return;
            }
            case PacketType.CONNACPT: {
                logIfSSGSDebug('Error: Server received outbound server packet: ' + parsedPacket.packetType);
                return;
            }
            case PacketType.CONNFAIL: {
                logIfSSGSDebug('Error: Server received outbound server packet: ' + parsedPacket.packetType);
                return;
            }
            default: {
                assert(false, 'Software Error: default clause in process() should never be reached');
            }
        }
    }

    /**
     * @method
     * @param {object} rinfo - the remote address information from the UDP socket
     * Sends a CONNFAIL packet to the remote address to indicate a connection failure
     */
    sendCONNFAIL(rinfo: dgram.RemoteInfo, gatewayUID: Buffer) {
        const fields: ParsedSSGSCPPacket = {
            packetType: PacketType.CONNFAIL,
            packetID: 0,
            gatewayUID: gatewayUID,
        };

        // CONNFAIL packets are not encrypted

        const packedPacket = SSGSCP.packSSGSCP(fields, Buffer.alloc(32));
        this.socket.send(packedPacket, rinfo.port, rinfo.address);
    }

    /**
     * @method
     * @param {object} rinfo - the remote address information from the UDP socket
     * Sends a CONNACPT packet to the remote address to indicate a connection success
     * This packet is sent in response to a CONN packet
     */
    sendCONNACPT(rinfo: dgram.RemoteInfo, key: Buffer, gatewayUID: Buffer) {
        const fields: ParsedSSGSCPPacket = {
            packetType: PacketType.CONNACPT,
            packetID: 0,
            gatewayUID: gatewayUID,
        };

        const packedPacket = SSGSCP.packSSGSCP(fields, key);
        this.socket.send(packedPacket, rinfo.port, rinfo.address);
        logIfSSGSDebug('Sent CONNACPT to ' + rinfo.address + ':' + rinfo.port);
    }

    /**
     * @method
     * @param {number} packetID - the packet ID to send
     * @param {object} rinfo - the remote address information from the UDP socket
     * Sends a RCPTOK packet to the remote address to indicate that the packet with the given packet ID was received correctly
     */
    sendRCPTOK(packetID: number, rinfo: dgram.RemoteInfo, key: Buffer, gatewayUID: Buffer) {
        const fields: ParsedSSGSCPPacket = {
            packetType: PacketType.RCPTOK,
            packetID: packetID,
            gatewayUID: gatewayUID,
        };

        const packedPacket = SSGSCP.packSSGSCP(fields, key);
        this.socket.send(packedPacket, rinfo.port, rinfo.address);
    }

    /**
     * @method
     * @param {Buffer} gatewayUID - the gateway UID to check
     * @returns {boolean} - true if the gateway UID is authorized, false otherwise
     * Checks if the gateway UID is authorized in the configuration file
     */
    isAuthorizedGateway(gatewayUID: Buffer): boolean {
        let matchingUIDFound = false;
        for (const authorizedGateway of this.authorizedGateways) {
            if (SSGS.gatewayUIDsMatch(authorizedGateway.gatewayUID, gatewayUID))
                matchingUIDFound = true;
        }

        return matchingUIDFound;
    }

    /**
     * @method
     * @param {Buffer} gatewayUID - the gateway UID to check
     * @returns {Buffer | null} - the key for the gateway UID if it is authorized, null otherwise
     * Checks if the gateway UID is authorized in the configuration file and returns the key if it is
     */
    getGatewayKey(gatewayUID: Buffer): Buffer | null {
        for (const authorizedGateway of this.authorizedGateways) {
            if (SSGS.gatewayUIDsMatch(authorizedGateway.gatewayUID, gatewayUID)) {
                return authorizedGateway.key;
            }
        }

        return null;
    }

    /**
     * @method
     * @param {Buffer} gatewayUID - the gateway UID to check
     * @returns {Client | null} - the client object if the gateway UID is connected, null otherwise
     * Checks if the gateway UID is connected and returns the client object if it is
     */
    getClientByGatewayUID(gatewayUID: Buffer): Client | null {
        // TODO: optimize this using a binary search hash table
        for (const client of this.connectedClients) {
            if (SSGS.gatewayUIDsMatch(client.gatewayUID, gatewayUID)) {
                return client;
            }
        }

        return null;
    }

    /**
     * @method
     * @param {string} configFilePath - the path to the SSGS configuration file 
     * Loads and parses the configuration file and sets up the authorized gateways and key properties
     */
    async loadConfig(configFilePath: string) {
        // load the config file
        this.configFile = JSON.parse(await fs.readFile(configFilePath, 'utf8'));
        this.authorizedGateways = [];

        // parse the authorized gateways
        for (const gateway of this.configFile.authorized_gateways) {
            // Parse the hex-formatted string and obtain a byte array
            const uid = Buffer.from(gateway.uid.replace(/\s/g, ''), 'hex');

            if (uid.length != 4)
                throw new Error('SSGS Config: uid length must be 4');

            // Parse the hex-formatted key string (256-bit key) and obtain a byte array
            const key = Buffer.from(gateway.key.replace(/\s/g, ''), 'hex');

            if (key.length != 32)
                throw new Error('SSGS Config: gateway key length must be 32');

            this.authorizedGateways.push({ gatewayUID: uid, key: key });
        }
    }


    /**
     * @method
     * @static
     * @param {Buffer} gatewayUID1 - the first gateway UID to compare
     * @param {Buffer} gatewayUID2 - the second gateway UID to compare
     * @returns {boolean} - true if the gateway UIDs match, false otherwise
     * Compares two gateway UIDs and returns true if they match, false otherwise
     * Gateway UIDs are 4 bytes long
     */
    static gatewayUIDsMatch(gatewayUID1: Buffer, gatewayUID2: Buffer): boolean {
        if (!gatewayUID1 || !gatewayUID2) // should not be null or undefined
            return false;

        if (gatewayUID1.length != 4 && gatewayUID2.length != 4) // should be 4 bytes long
            return false;

        // compare each byte
        for (let i = 0; i < 4; i++) {
            if (gatewayUID1[i] != gatewayUID2[i])
                return false;
        }

        return true;
    }

    /**
     * @method
     * @static
     * @param {Buffer} uid - the UID to convert to a string
     * @returns {string} - the UID as a string
     * Converts a UID to a string
     */
    static uidToString(uid: Buffer): string {
        if (!uid || uid.length != 4)
            return 'Invalid UID';

        // UID should be outputted as [ab cd ef 12]
        let uidString = '[';
        for (let i = 0; i < uid.length; i++) {
            uidString += uid[i].toString(16).padStart(2, '0');
            if (i != uid.length - 1)
                uidString += ' ';
        }
        uidString += ']';

        return uidString;
    }
};

export default SSGS;
export { MessageSubtype };
export { SensorSealUpdate };
export { ParsedMessage };


/**
 * @function
 * @param {string} info - the debug information to log 
 * Logs the debug information if __SSGS_DEBUG is true
 */
function logIfSSGSDebug(info: any) {
    if (__SSGS_DEBUG)
        console.log('SSGS Debug Info:', info);
}
