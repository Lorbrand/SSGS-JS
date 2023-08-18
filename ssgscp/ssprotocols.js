;
function buffersEqual(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    for (var i = 0; i < a.length; i++) {
        if (a[i] != b[i]) {
            return false;
        }
    }
    return true;
}
function parseSSRB(parsedSSGSCP) {
    // check if the packet is an SSRB packet
    if (!buffersEqual(parsedSSGSCP.payload.subarray(0, 4), [0x53, 0x53, 0x52, 0x42])) {
        return null;
    }
    var offset = 4;
    var roundTo1dp = function (num) { return Math.round(num * 10) / 10; };
    var ssrbVersion = parsedSSGSCP.payload[offset];
    offset += 1;
    if (ssrbVersion < 2) {
        return null;
    }
    var sensorSealUID = parsedSSGSCP.payload.subarray(offset, offset + 4);
    offset += 4;
    var msgID = parsedSSGSCP.payload.readUInt32LE(offset);
    offset += 4;
    var temperature = roundTo1dp(parsedSSGSCP.payload.readFloatLE(offset));
    offset += 4;
    var rpm = roundTo1dp(parsedSSGSCP.payload.readFloatLE(offset));
    offset += 4;
    var vibration = parsedSSGSCP.payload.readUInt32LE(offset);
    offset += 4;
    var voltage = parsedSSGSCP.payload.readUInt32LE(offset);
    return {
        sensorSealUID: sensorSealUID,
        viaGatewayUID: parsedSSGSCP.gatewayUID,
        updateID: msgID,
        temperature: temperature === 0 ? null : temperature,
        vibration: vibration === 0 ? null : vibration,
        voltage: voltage === 0 ? null : voltage,
        rpm: rpm === 0 ? null : rpm
    };
}
var SSProtocols = {
    parse: function (parsedSSGSCP) {
        switch (parsedSSGSCP.payload[0]) {
            case 3 /* MessageSubtype.REMOTE_TERMINAL_OUTPUT */:
                return {
                    gatewayUID: parsedSSGSCP.gatewayUID,
                    rawPayload: parsedSSGSCP.payload,
                    data: parsedSSGSCP.payload.subarray(1).toString(),
                    messageType: 3 /* MessageSubtype.REMOTE_TERMINAL_OUTPUT */
                };
            case 83 /* MessageSubtype.SSRB_UPDATE */:
                var ssrbUpdate = parseSSRB(parsedSSGSCP);
                return {
                    gatewayUID: parsedSSGSCP.gatewayUID,
                    rawPayload: parsedSSGSCP.payload,
                    data: ssrbUpdate,
                    messageType: ssrbUpdate ? 83 /* MessageSubtype.SSRB_UPDATE */ : 0 /* MessageSubtype.INVALID */
                };
        }
        return null;
    }
};
export default SSProtocols;
