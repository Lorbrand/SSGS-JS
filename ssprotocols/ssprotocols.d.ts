/// <reference types="node" />
export type SensorSealUpdateParams = {
    sensorSealUID?: Buffer;
    temperature?: number;
    vibration?: number;
    rpm?: number;
    voltage?: number;
    msgID?: number;
};
declare const SSProtocols: {
    /**
     * @static
     * @param {Buffer} ssgscpPayload the payload data of an SSGSCP packet
     * @returns {SensorSealUpdateParams} the parsed data
     * Parses SSGSCP packet payload data
     */
    parse: (ssgscpPayload: any) => SensorSealUpdateParams;
};
export default SSProtocols;
