

import SSGS from './dist/index.js'

new SSGS(1818, client => {
    // Called when a new client connects
    
    console.log('New client connected');

    // Print all messages received from the client
    client.onmessage = message => {
        console.log(`\nReceived Sensor Seal update via gateway ${SSGS.uidToString(message.gatewayUID)}:`);
        console.log(`Sensor Seal UID: ${SSGS.uidToString(message.sensorSealUID)}`);
        console.log(`Temperature: ${message.temperature} deg C`);
        console.log(`Vibration: ${message.vibration} mm/s^2`);
        console.log(`Speed: ${message.rpm} rpm`);
        console.log(`Voltage: ${message.voltage} mV`);
        console.log(`Message ID: ${message.msgID}`);
    };

    // Called when the client reconnects (power to gateway was lost and it restarted)
    client.onreconnect = () => {
        console.log('Client reconnected');
    }
});



