/// <reference types="node" />
import { ParsedSSGSCPPacket } from "./ssgscp";
import { MessageSubtype } from "./ssgscp";
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
    data: SensorSealUpdate | string | number;
    messageType: MessageSubtype;
};
declare const SSProtocols: {
    parse: (parsedSSGSCP: ParsedSSGSCPPacket) => ParsedMessage;
};
export default SSProtocols;
