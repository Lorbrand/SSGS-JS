
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

// Define the parameters of a Sensor Seal Update packet
export type SensorSealUpdateParams = {
    sensorSealUID?: Buffer,
    temperature?: number,
    vibration?: number,
    rpm?: number,
    voltage?: number,
    msgID?: number,
};

function parseSSRB(ssgscpPayload: Buffer): SensorSealUpdateParams {
    let offset = 4;

    const roundTo1dp = (num: number) => Math.round(num * 10) / 10;

    const sensorSealUID = ssgscpPayload.subarray(offset, offset + 4);
    offset += 4;

    const msgID = ssgscpPayload.readUInt32LE(offset);
    offset += 4;

    const temperature = roundTo1dp(ssgscpPayload.readFloatLE(offset));
    offset += 4;

    const rpm = roundTo1dp(ssgscpPayload.readFloatLE(offset));
    offset += 4;

    const vibration = ssgscpPayload.readUInt32LE(offset);
    offset += 4;

    const voltage = ssgscpPayload.readUInt32LE(offset);

    return {
        sensorSealUID,
        temperature,
        vibration,
        rpm,
        voltage,
        msgID,
    };
}

const SSProtocols = {
    /**
     * @static
     * @param {Buffer} ssgscpPayload the payload data of an SSGSCP packet
     * @returns {SensorSealUpdateParams} the parsed data
     * Parses SSGSCP packet payload data
     */
    parse: function (ssgscpPayload): SensorSealUpdateParams {

        // check if the packet is an SSRB packet
        if (buffersEqual(ssgscpPayload.subarray(0, 4), [0x53, 0x53, 0x52, 0x42])) {
            return parseSSRB(ssgscpPayload);
        }

        return {};
    }
};

export default SSProtocols; 
