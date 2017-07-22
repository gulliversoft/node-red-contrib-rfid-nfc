
//https://iotdk.intel.com/docs/master/mraa/node/classes/common.html
//https://jasongfox.com/2015/08/17/building-a-device-driver-using-mraa-and-javascript-introduction/
var node;
var Buffer;
module.exports = function (RED) {
    function PN532(config) {
        RED.nodes.createNode(this, config);
        node = this;
        node.on('input', function (msg) {
            //msg.payload = most_easiest_getFirmwareVersion();
            //node.send(msg);
            //msg.payload = easygetFirmwareVersion();
            NFC.begin();
            NFC.SAMConfig();
            msg.payload = NFC.getFirmwareVersion();
            //GALILEO.periodicActivity();
            node.send(msg);
        });
    }
    RED.nodes.registerType("PN532", PN532);
}

var PN532_I2C_ADDRESS = 2;

function sleep(milliseconds) {
    var start = new Date().getTime();
    for (var i = 0; i < 1e7; i++) {
        if ((new Date().getTime() - start) > milliseconds) {
            break;
        }
    }
}

/**************************************************************************/
/*! 
@brief  PN532 nfc shield abstraction
*/
/**************************************************************************/
var NFC = {
    PN532_PACKBUFFSIZ: 64,
    PN532_COMMAND_DIAGNOSE: 0x00,
    PN532_COMMAND_GETFIRMWAREVERSION: 0x02,
    PN532_COMMAND_GETGENERALSTATUS: 0x04,
    PN532_COMMAND_READREGISTER: 0x06,
    PN532_COMMAND_WRITEREGISTER: 0x08,
    PN532_COMMAND_READGPIO: 0x0C,
    PN532_COMMAND_WRITEGPIO: 0x0E,
    PN532_COMMAND_SETSERIALBAUDRATE: 0x10,
    PN532_COMMAND_SETPARAMETERS: 0x12,
    PN532_COMMAND_SAMCONFIGURATION: 0x14,
    PN532_COMMAND_POWERDOWN: 0x16,
    PN532_COMMAND_RFCONFIGURATION: 0x32,
    PN532_COMMAND_RFREGULATIONTEST: 0x58,
    PN532_COMMAND_INJUMPFORDEP: 0x56,
    PN532_COMMAND_INJUMPFORPSL: 0x46,
    PN532_COMMAND_INLISTPASSIVETARGET: 0x4A,
    PN532_COMMAND_INATR: 0x50,
    PN532_COMMAND_INPSL: 0x4E,
    PN532_COMMAND_INDATAEXCHANGE: 0x40,
    PN532_COMMAND_INCOMMUNICATETHRU: 0x42,
    PN532_COMMAND_INDESELECT: 0x44,
    PN532_COMMAND_INRELEASE: 0x52,
    PN532_COMMAND_INSELECT: 0x54,
    PN532_COMMAND_INAUTOPOLL: 0x60,
    PN532_COMMAND_TGINITASTARGET: 0x8C,
    PN532_COMMAND_TGSETGENERALBYTES: 0x92,
    PN532_COMMAND_TGGETDATA: 0x86,
    PN532_COMMAND_TGSETDATA: 0x8E,
    PN532_COMMAND_TGSETMETADATA: 0x94,
    PN532_COMMAND_TGGETINITIATORCOMMAND: 0x88,
    PN532_COMMAND_TGRESPONSETOINITIATOR: 0x90,
    PN532_COMMAND_TGGETTARGETSTATUS: 0x8A,
    PN532_RESPONSE_INDATAEXCHANGE: 0x41,
    PN532_RESPONSE_INLISTPASSIVETARGET: 0x4B,
    PN532_WAKEUP: 0x55,
    response: 0,
    pin: 3,
    /**************************************************************************/
    /*! 
    @brief  Configures the SAM (Secure Access Module)
    */
    /**************************************************************************/
    SAMConfig: function () {
        var pn532_packetbuffer = Array(this.PN532_PACKBUFFSIZ);
        pn532_packetbuffer[0] = this.PN532_COMMAND_SAMCONFIGURATION;
        pn532_packetbuffer[1] = 0x01; // normal mode;
        pn532_packetbuffer[2] = 0x14; // timeout 50ms * 20 = 1 second
        pn532_packetbuffer[3] = 0x01; // use IRQ pin! 

        if (!this.sendCommandCheckAck(pn532_packetbuffer, 4))
            return false;

        // read data packet
        this.readData(pn532_packetbuffer, 8);
        return (pn532_packetbuffer[6] == 0x15);
    },
    begin: function () {
        WIRE.setBusAddress();

        // Reset the PN532  
        var res1 = GALILEO.digitalWrite(this.pin, GALILEO.HIGH);
        var res2 = GALILEO.digitalWrite(this.pin, GALILEO.LOW);
        sleep(400);
        var res3 = GALILEO.digitalWrite(this.pin, GALILEO.HIGH);
        node.warn("HIGH:" + res1 + " LOW:" + res2 + " HIGH:" + res3);

    },
    /**************************************************************************/
    /*! 
    @brief  Checks the firmware version of the PN5xx chip

    @returns  The chip's firmware version and ID
    */
    /**************************************************************************/
    getFirmwareVersion: function () {
        var response = 0;
        var pn532_packetbuffer = Array(this.PN532_PACKBUFFSIZ);
        pn532_packetbuffer[0] = this.PN532_COMMAND_GETFIRMWAREVERSION;

        if (!this.sendCommandCheckAck(pn532_packetbuffer, 1))
            return 0;

        // read data packet
        pn532_packetbuffer = this.readData(pn532_packetbuffer, 12);


        response = pn532_packetbuffer[7];
        response <<= 8;
        response |= pn532_packetbuffer[8];
        response <<= 8;
        response |= pn532_packetbuffer[9];
        response <<= 8;
        response |= pn532_packetbuffer[10];

        return response;
    },
    /**************************************************************************/
    /*! 
    @brief  Checks the IRQ pin to know if the PN532 is ready
	
    @returns 0 if the PN532 is busy, 1 if it is free
    */
    /**************************************************************************/
    readStatus: function () {
        var PN532_I2C_READY = 0x01;
        var PN532_I2C_BUSY = 0x00;
        var x = GALILEO.digitalRead(this.pin);
        if (x == 1)
            return PN532_I2C_BUSY;
        else
            return PN532_I2C_READY;
    },
    /**************************************************************************/
    /*! 
    @brief  Sends a command and waits a specified period for the ACK

    @param  cmd       Pointer to the command buffer
    @param  cmdlen    The size of the command in bytes 
    @param  timeout   timeout before giving up
    
    @returns  1 if everything is OK, 0 if timeout occured before an
    ACK was recieved
    */
    /**************************************************************************/
    sendCommandCheckAck: function (cmd, cmdlen) {
        // write the command
        this.sendCommand(cmd, cmdlen);

        // read acknowledgement
        if (!this.readAckFrame()) {
            this.error("No ACK frame received!");
            return false;
        }

        return true; // ack'd command
    },
    /**************************************************************************/
    /*! 
    @brief  Tries to read the PN532 ACK frame (not to be confused with 
    the I2C ACK signal)
    */
    /**************************************************************************/
    readAckFrame: function () {
        var ackbuff = [0, 0, 0, 0, 0, 0];
        var timer = 0;
        var timeout = 1000;
        var PN532_I2C_READY = 0x01;

        // Wait for chip to say its ready!
        while (this.readStatus() != PN532_I2C_READY) {
            if (timeout != 0) {
                timer += 10;
                if (timer > timeout)
                    return false;
            }
            sleep(10);
        }

        node.warn("IRQ received");
        ackbuff = this.readData(ackbuff, ackbuff.length);
        var ackOK = [0x00, 0x00, 0xFF, 0x00, 0xFF, 0x00];
        for(var i = 0; i < ackbuff.length; i++)
        {
            if (ackbuff[i] != ackOK[i]) 
            {
                return false;
            }
        }
        return true;
    },
    /**************************************************************************/
    /*! 
    @brief  Writes a command to the PN532, automatically inserting the
    preamble and required frame details (checksum, len, etc.)
    @param  cmd       Pointer to the command buffer
    @param  cmdlen    Command length in bytes 
    */
    /**************************************************************************/
    sendCommand: function (cmd, cmdlen) {
        var checksum;
        var PN532_PREAMBLE = 0x00;
        var PN532_STARTCODE1 = 0x00;
        var PN532_STARTCODE2 = 0xFF;
        var PN532_POSTAMBLE = 0x00;
        var PN532_HOSTTOPN532 = 0xD4;
        var PN532_PN532TOHOST = 0xD5;
        sleep(2); // or whatever the delay is for waking up the board

        // I2C START
        WIRE.setBusAddress();
        checksum = 0;
        node.warn("Send 00 00 ff 0" + (cmdlen + 1) + " " + (0xFF + ~cmdlen + 1).toString(16) + " d4 " + cmd[0].toString(16) + "..." + (0xFF + ~PN532_HOSTTOPN532 + 1 - cmdlen).toString(16) + " 00");
        WIRE.send(PN532_PREAMBLE);
        WIRE.send(PN532_PREAMBLE);
        WIRE.send(PN532_STARTCODE2);
        WIRE.send(cmdlen + 1);
        WIRE.send(0xFF + ~cmdlen + 1);
        WIRE.send(PN532_HOSTTOPN532);

        for (var i = 0; i < cmdlen; i++) {
            WIRE.send(cmd[i]);
            checksum += cmd[i];
        }
        WIRE.send(0xFF + ~checksum + 1 - cmdlen);
        WIRE.send(PN532_POSTAMBLE);

        // I2C STOP
        //WIRE.endTransmission();
    },
    /**************************************************************************/
    /*! 
    @brief  Reads n bytes of data from the PN532 via I2C
    @param  buff      Pointer to the buffer where data will be written
    @param  len         Number of bytes to be read
    */
    /**************************************************************************/
    readData: function (buff, len) {
        node.warn("Reading data: ");
        buff = WIRE.receivemultibyte(buff, len);
        return buff;
    }
}
/**************************************************************************/
/*! 
@brief  galileo abstraction 
*/
/**************************************************************************/
var GALILEO = {
    pin: 2,
    HIGH: 0x1,
    LOW: 0x0,
    INPUT: 0x0,
    OUTPUT: 0x1,
    interrupt: 0,
    vendor: 0,
    value: 0,
    activeISR: 0,
    _mraa: require("mraa"),
    _gpio: 0,
    periodicActivity: function () {
        this.interrupt = this.x.read();
        setTimeout(periodicActivity, 500);
    },
    digitalWrite: function (pin, level) {
        this.pin = pin;
        this._gpio = new this._mraa.Gpio(parseInt(this.pin));
        /*Set the mode General Purpose IO*/
        this._gpio.mode(this._mraa.PIN_GPIO);
        this._gpio.dir(this._mraa.DIR_OUT_HIGH);
        var result = this._gpio.write(level);
        return result;
    },
    digitalRead: function (pin) {
        this.pin = pin;
        this.activeISR = 1;
        this.vendor = this._mraa.getPlatformName();
        node.warn(this.vendor);
        this._gpio = new this._mraa.Gpio(parseInt(this.pin));
        /*Set the mode General Purpose IO*/
        this._gpio.mode(this._mraa.PIN_GPIO);
        this._gpio.dir(this._mraa.DIR_IN);
        /*Interrupt on rising & falling*/
        this._gpio.isr(this._mraa.EDGE_BOTH, function () {
            this.interrupt = this._gpio.read();
            var msg = { payload: this.interrupt, topic: this.board + "/D" + this.pin };
            node.warn(msg);
            switch (g) {
                case 0:
                    node.status({ fill: "green", shape: "ring", text: "low" });
                    if (this.interrupt === "f" || this.interrupt === "b") {
                        node.send(msg);
                    }
                    break;
                case 1:
                    node.status({ fill: "green", shape: "dot", text: "high" });
                    if (this.interrupt === "r" || this.interrupt === "b") {
                        node.send(msg);
                    }
                    break;
                default:
                    node.status({ fill: "grey", shape: "ring", text: "unknown" });
            }
        })

        sleep(100);
        return this.interrupt;
    }
}
/**************************************************************************/
/*! 
@brief  I2C bus abstraction on address 2 
*/
/**************************************************************************/
var WIRE = {
    MAX_BUFFER_LENGTH: 6,
    CONF_BUFFER_LENGTH: 2,
    I2C_ADDRESS: 2,
    conf_buff: 0,
    rx_tx_buf: [0, 0, 0, 0, 0, 0],
    i2c: initI2C(PN532_I2C_ADDRESS),
    get_address: function () {
        return this.I2C_ADDRESS;
    },

    get_buffer_len: function () {
        return this.rx_tx_buf.length;
    },

    get_configuration_len: function () {
        return this.conf_buf.length;
    },

    writecmd: function (cmd, cmdlen) {
        if (!node.buffer) {
            node.warn("Allocating buffer");
            this.conf_buff = Buffer.alloc(this.CONF_BUFFER_LENGTH);
        }
        this.conf_buff[0] = cmd;
        this.conf_buff[1] = cmdlen;
        this.conf_buff = _conf_buff;
        this.i2c.write(this.conf_buff);
    },

    send: function (x) {
        return this.i2c.writeByte(x);
    },

    receive: function () {
        return this.i2c.readByte();
    },

    endTransmission: function () {
        this.i2c.stop();
    },

    setBusAddress: function () {
        this.i2c.address(parseInt(this.I2C_ADDRESS));
    },

    receivemultibyte: function (buff, len) {
        return this.i2c.read(parseInt(len));
    }

}


function initI2C (address) {
    var mraa = require("mraa");
    var _i2c = new mraa.I2c(0);
    /**
    * Set the slave to talk to, typically called before every read/write
    * operation
    *
    * @param address Communicate to the i2c slave on this address
    * @return Result of operation
    */
    _i2c.address(address);
    return _i2c;
}

