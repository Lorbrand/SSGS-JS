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
function parseSSRB(ssgscpPayload) {
    var offset = 4;
    var roundTo1dp = function (num) { return Math.round(num * 10) / 10; };
    var sensorSealUID = ssgscpPayload.subarray(offset, offset + 4);
    offset += 4;
    var msgID = ssgscpPayload.readUInt32LE(offset);
    offset += 4;
    var temperature = roundTo1dp(ssgscpPayload.readFloatLE(offset));
    offset += 4;
    var rpm = roundTo1dp(ssgscpPayload.readFloatLE(offset));
    offset += 4;
    var vibration = ssgscpPayload.readUInt32LE(offset);
    offset += 4;
    var voltage = ssgscpPayload.readUInt32LE(offset);
    return {
        sensorSealUID: sensorSealUID,
        temperature: temperature,
        vibration: vibration,
        rpm: rpm,
        voltage: voltage,
        msgID: msgID,
    };
}
var SSProtocols = {
    /**
     * @static
     * @param {Buffer} ssgscpPayload the payload data of an SSGSCP packet
     * @returns {SensorSealUpdateParams} the parsed data
     * Parses SSGSCP packet payload data
     */
    parse: function (ssgscpPayload) {
        // check if the packet is an SSRB packet
        if (buffersEqual(ssgscpPayload.subarray(0, 4), [0x53, 0x53, 0x52, 0x42])) {
            return parseSSRB(ssgscpPayload);
        }
        return {};
    }
};
export default SSProtocols;
