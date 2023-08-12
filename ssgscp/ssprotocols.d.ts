/// <reference types="node" />
import { ParsedSSGSCPPacket } from "./ssgscp";
export declare const enum MessageSubtype {
    INVALID = 0,
    SET_GATEWAY_CONFIG = 1,
    REMOTE_TERMINAL_INPUT = 2,
    REMOTE_TERMINAL_OUTPUT = 3,
    SSRB_UPDATE = 83
}
export type SensorSealUpdate = {
    sensorSealUID: Buffer;
    viaGatewayUID: Buffer;
    updateID: number;
    temperature: number | null;
    vibration: number | null;
    voltage: number | null;
    rpm: number | null;
};
export type ParsedMessage = {
    gatewayUID: Buffer;
    rawPayload: Buffer;
    data: SensorSealUpdate | string;
    messageType: MessageSubtype;
};
declare const SSProtocols: {
    parse: (parsedSSGSCP: ParsedSSGSCPPacket) => ParsedMessage;
};
export default SSProtocols;
