

import SSGS from './index.js';

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

    setInterval(async () => {
        // Send a message to the client
        const success = await client.send(Buffer.from('Hello from the gateway!'));
        console.log(`Message sent: ${success}`);
    }, 1000);


    // Called when the client reconnects (power to gateway was lost and it restarted)
    client.onreconnect = () => {
        console.log('Client reconnected');
    }
});



