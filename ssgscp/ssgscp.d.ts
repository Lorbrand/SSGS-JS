/// <reference types="node" />
export declare const enum PacketType {
    CONN = 1,
    CONNACPT = 2,
    CONNFAIL = 3,
    RCPTOK = 10,
    MSGCONF = 20,
    MSGSTATUS = 21
}
export declare const enum MessageSubtype {
    INVALID = 0,
    PING_PONG = 1,
    REMOTE_TERMINAL_INPUT = 2,
    GATEWAY_RESTART = 3,
    SET_RADIO_PARAMS = 4,
    SEND_PACKET = 5,
    RESET_RADIO_PARAMS = 6,
    WFU_PACKET = 7,
    REMOTE_TERMINAL_OUTPUT = 3,
    WAKEUP_SCAN = 4,
    SSRB_UPDATE = 83
}
export type ParsedSSGSCPPacket = {
    authSuccess?: true | false;
    packetType?: PacketType;
    encryptionAuthenticationCode?: Buffer | Buffer;
    gatewayUID?: Buffer | Buffer;
    packetID?: number;
    payload?: Buffer | Buffer;
};
/**
 * This class defines various static methods for parsing and constructing
 * SSGSCP packets
 */
export declare class SSGSCP {
    static PACKET_IDENTIFIER: Buffer;
    /**
    * Packs and encrypts SSGSCP fields into their packet form
    * @param {Object} packet an object containing the SSGSCP packet fields (packetType, gatewayUID, packetID, payload)
    * @param {Buffer} key the key used to encrypt the encrypted portion of the packet
    * @returns {Buffer} a byte array containing the packed SSGSCP packet
    */
    static packSSGSCP(packet: ParsedSSGSCPPacket, key: Buffer | Buffer): Promise<Buffer | null>;
    /**
     * Tries to parses a UDP datagram containing an SSGSCP packet
     * @static
     * @param {Buffer} datagram the datagram containing the SSGSCP packet to parse
     * @param {Buffer} key the key used to decrypt the encrypted portion of the packet
     * @returns {Object} the parsed SSGSCP packet fields or null if the packet cannot be parsed
     */
    static parseSSGSCP(datagram: Buffer, key: Buffer): Promise<ParsedSSGSCPPacket>;
    /**
     * Tries to parse a UDP datagram containing an SSGSCP packet and returns the gateway UID
     * @static
     * @param {Buffer} datagram the datagram containing the SSGSCP packet to parse
     * @returns {Buffer} the gateway UID or null if the packet cannot be parsed
     */
    static parsePacketGatewayUID(datagram: Buffer): Buffer;
    /**
     * Checks if a datagram has a valid SSGSCP packet
     * @static
     * @param {Buffer} datagram a udp datagram
     * @returns {boolean} true if the datagram contains a valid SSGSCP payload, false if not
     */
    static isSSGSCP(datagram: Buffer): boolean;
    static getU16BE(buffer: Buffer): number;
    static setU16BE(value: number): Buffer;
    static errMsg: string;
}
