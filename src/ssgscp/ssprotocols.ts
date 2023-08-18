import { ParsedSSGSCPPacket } from "./ssgscp";

// Define the SSGSCP MSG subtypes
export const enum MessageSubtype {
    // Invalid message type
    INVALID = 0x00,

    // <Gateway Manager Web Client> -> Server -> Gateway. (Server -> Gateway is a MSGCONF message)
    SET_GATEWAY_CONFIG = 0x01, // A message from the web client to the gateway to set the gateway's configuration (e.g.)
    REMOTE_TERMINAL_INPUT = 0x02, // A message from the web client+server to the gateway to be processed by the gateway's remote terminal service

    // Gateway -> Server -> <Gateway Manager Web Client> (Gateway -> Server is a MSGSTATUS message)
    REMOTE_TERMINAL_OUTPUT = 0x03, // A message from the gateway's remote terminal service to the web client
    SSRB_UPDATE = 0x53, // A message from the gateway to the server containing an SSRB update from a Sensor Seal

};

export type SensorSealUpdate = {
    sensorSealUID: Buffer; // the UID of the sensor seal that sent the update
    viaGatewayUID: Buffer; // the UID of the gateway that sent the update
    updateID: number; // the update ID of the update
    temperature: number | null; // the temperature value in degrees Celsius, or null if not present
    vibration: number | null; // the vibration value mm/s^2 , or null if not present
    voltage: number | null; // the generated voltage in volts, or null if not present
    rpm: number | null; // the RPM value, or null if not present
};

export type ParsedMessage = {
    gatewayUID: Buffer; // the UID of the gateway that sent the update
    rawPayload: Buffer; // the raw payload contents of the SSGSCP packet
    data: SensorSealUpdate | string; // the parsed data
    messageType: MessageSubtype; // the type of message
};

function buffersEqual(a, b) {
    if (a.length !== b.length) {
        return false;
    }

    for (let i = 0; i < a.length; i++) {
        if (a[i] != b[i]) {
            return false;
        }
    }

    return true;
}

function parseSSRB(parsedSSGSCP: ParsedSSGSCPPacket): SensorSealUpdate {
    // check if the packet is an SSRB packet
    if (!buffersEqual(parsedSSGSCP.payload.subarray(0, 4), [0x53, 0x53, 0x52, 0x42])) {
        return null;
    }

    let offset = 4;

    const roundTo1dp = (num: number) => Math.round(num * 10) / 10;

    const ssrbVersion = parsedSSGSCP.payload[offset];
    offset += 1;

    if (ssrbVersion < 2) {
        return null;
    }

    const sensorSealUID = parsedSSGSCP.payload.subarray(offset, offset + 4);
    offset += 4;

    const msgID = parsedSSGSCP.payload.readUInt32LE(offset);
    offset += 4;

    const temperature = roundTo1dp(parsedSSGSCP.payload.readFloatLE(offset));
    offset += 4;

    const rpm = roundTo1dp(parsedSSGSCP.payload.readFloatLE(offset));
    offset += 4;

    const vibration = parsedSSGSCP.payload.readUInt32LE(offset);
    offset += 4;

    const voltage = parsedSSGSCP.payload.readUInt32LE(offset);

    return <SensorSealUpdate>{
        sensorSealUID,
        viaGatewayUID: parsedSSGSCP.gatewayUID,
        updateID: msgID,
        temperature: temperature === 0 ? null : temperature,
        vibration: vibration === 0 ? null : vibration,
        voltage: voltage === 0 ? null : voltage,
        rpm: rpm === 0 ? null : rpm
    };
}

const SSProtocols = {


    parse: function (parsedSSGSCP: ParsedSSGSCPPacket): ParsedMessage {

        switch (parsedSSGSCP.payload[0]) {
            case MessageSubtype.REMOTE_TERMINAL_OUTPUT:
                return {
                    gatewayUID: parsedSSGSCP.gatewayUID,
                    rawPayload: parsedSSGSCP.payload,
                    data: parsedSSGSCP.payload.subarray(1).toString(),
                    messageType: MessageSubtype.REMOTE_TERMINAL_OUTPUT
                };

            case MessageSubtype.SSRB_UPDATE:
                const ssrbUpdate = parseSSRB(parsedSSGSCP);
                return {
                    gatewayUID: parsedSSGSCP.gatewayUID,
                    rawPayload: parsedSSGSCP.payload,
                    data: ssrbUpdate,
                    messageType: ssrbUpdate ? MessageSubtype.SSRB_UPDATE : MessageSubtype.INVALID
                };

        }

        return null;
    }
};

export default SSProtocols; 
