/// <reference types="node" />
/// <reference types="node" />
import * as dgram from 'node:dgram';
import { PacketType } from './ssgscp/ssgscp.js';
type ConfigFile = {
    key: string;
    authorized_gateways: Array<{
        uid: string;
        key: string;
    }>;
};
type SensorSealUpdate = {
    gatewayUID: Buffer;
    rawPayload: Buffer;
    sensorSealUID: Buffer;
    temperature: number | null;
    vibration: number | null;
    voltage: number | null;
    rpm: number | null;
    msgID: number | null;
};
type AuthorizedGateway = {
    gatewayUID: Buffer;
    key: Buffer;
};
type SentMessage = {
    packetID: number;
    timestamp: number;
    packet: Buffer;
    resolve: (receivedOk: boolean) => void;
    receivedOk: boolean;
    retransmissionCount: number;
};
type Client = {
    gatewayUID: Buffer;
    sourcePort: number;
    remoteAddress: string;
    lastSeen: number;
    sendPacketID: number;
    retransmissionTimeout: number;
    sentMessages: Array<SentMessage>;
    receivedMessageIDsFIFO: Array<number>;
    key: Buffer;
    onmessage: (update: SensorSealUpdate) => void;
    onreconnect: () => void;
    /**
     * @method
     * @param {Buffer} payload - the payload to send to the client
     * @returns {Promise<boolean>} - whether the message was received ok
     * Sends a MSGCONF packet to the client and returns a promise resolving to whether the message was
     * received ok or false after it has been retransmitted RETRANSMISSION_COUNT_MAX times
     */
    send: (payload: Buffer) => Promise<boolean>;
};
declare class SSGS {
    port: number;
    onconnection: (client: Client) => void;
    configFilePath: string;
    socket: dgram.Socket;
    configFile: ConfigFile;
    authorizedGateways: Array<AuthorizedGateway>;
    connectedClients: Array<Client>;
    /**
     * @constructor
     * @param {number} port - the UDP port number to listen for SSGSCP packets, default is 1818
     * @param {function} onmessage - the callback function to handle incoming messages
     * @param {string} configFilePath - the path to the SSGS configuration file, default is './config.json'
     */
    constructor(port: number, onconnection: (client: Client) => void, configFilePath?: string);
    /**
     * @method
     * @async
     * Starts the SSGS server by loading the configuration file and listening for incoming messages on the specified UDP port
     */
    begin(): Promise<void>;
    /**
     * @method
     * @returns {void}
     * Ticks the connected clients to check for required retransmissions
     * This function should be called periodically, e.g. every 200ms
     * Sends at most 10 retransmissions per client per tick
     */
    tickClients(): void;
    /**
     * @method
     * @param {Client} client - the client to send the message to
     * @param {PacketType} packetType - the type of packet to send
     * @param {Buffer} payload - the payload of the packet
     * @returns {void}
     * Sends a message to the specified client
     * The message is added to the sentMessages list and will be retransmitted if no RCPTOK packet is received within the retransmission timeout
     */
    sendMSG(client: Client, packetType: PacketType, payload: Buffer): Promise<boolean>;
    /**
     * @method
     * @param {object} parsedPacket - the parsed packet object from SSGSCP.parseSSGSCP
     * @param {object} rinfo - the remote address information from the UDP socket
     * Processes the incoming packet and calls the onmessage callback function
     */
    process(datagram: Buffer, rinfo: dgram.RemoteInfo): void;
    /**
     * @method
     * @param {object} rinfo - the remote address information from the UDP socket
     * Sends a CONNFAIL packet to the remote address to indicate a connection failure
     */
    sendCONNFAIL(rinfo: dgram.RemoteInfo, gatewayUID: Buffer): void;
    /**
     * @method
     * @param {object} rinfo - the remote address information from the UDP socket
     * Sends a CONNACPT packet to the remote address to indicate a connection success
     * This packet is sent in response to a CONN packet
     */
    sendCONNACPT(rinfo: dgram.RemoteInfo, key: Buffer, gatewayUID: Buffer): void;
    /**
     * @method
     * @param {number} packetID - the packet ID to send
     * @param {object} rinfo - the remote address information from the UDP socket
     * Sends a RCPTOK packet to the remote address to indicate that the packet with the given packet ID was received correctly
     */
    sendRCPTOK(packetID: number, rinfo: dgram.RemoteInfo, key: Buffer, gatewayUID: Buffer): void;
    /**
     * @method
     * @param {Buffer} gatewayUID - the gateway UID to check
     * @returns {boolean} - true if the gateway UID is authorized, false otherwise
     * Checks if the gateway UID is authorized in the configuration file
     */
    isAuthorizedGateway(gatewayUID: Buffer): boolean;
    /**
     * @method
     * @param {Buffer} gatewayUID - the gateway UID to check
     * @returns {Buffer | null} - the key for the gateway UID if it is authorized, null otherwise
     * Checks if the gateway UID is authorized in the configuration file and returns the key if it is
     */
    getGatewayKey(gatewayUID: Buffer): Buffer | null;
    /**
     * @method
     * @param {string} configFilePath - the path to the SSGS configuration file
     * Loads and parses the configuration file and sets up the authorized gateways and key properties
     */
    loadConfig(configFilePath: string): Promise<void>;
    /**
     * @method
     * @static
     * @param {Buffer} gatewayUID1 - the first gateway UID to compare
     * @param {Buffer} gatewayUID2 - the second gateway UID to compare
     * @returns {boolean} - true if the gateway UIDs match, false otherwise
     * Compares two gateway UIDs and returns true if they match, false otherwise
     * Gateway UIDs are 4 bytes long
     */
    static gatewayUIDsMatch(gatewayUID1: Buffer, gatewayUID2: Buffer): boolean;
    /**
     * @method
     * @static
     * @param {Buffer} uid - the UID to convert to a string
     * @returns {string} - the UID as a string
     * Converts a UID to a string
     */
    static uidToString(uid: Buffer): string;
}
export default SSGS;
