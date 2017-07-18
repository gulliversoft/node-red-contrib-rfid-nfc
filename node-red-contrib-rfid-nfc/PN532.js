
var node;
var Buffer;
module.exports = function (RED) {
    function PN532(config) {
        RED.nodes.createNode(this, config);
        node = this;
        node.on('input', function (msg) {
            //msg.payload = most_easiest_getFirmwareVersion();
            //node.send(msg);
            msg.payload = easygetFirmwareVersion();
            node.send(msg);
        });
    }
    RED.nodes.registerType("PN532", PN532);
}

var PN532_I2C_ADDRESS = 2;
/**************************************************************************/
/*! 
@brief  More simplified read of the firmware version of the PN5xx chip

@returns  The chip's firmware version and ID
*/
/**************************************************************************/
function most_easiest_getFirmwareVersion() {
    var response = "None"
    var PN532_COMMAND_GETFIRMWAREVERSION = 0x02;
    var PN532_PACKBUFFSIZ = 64;
    var pn532_packetbuffer = Array(PN532_PACKBUFFSIZ);
    wirebegin();
    WIRE.writecmd(PN532_COMMAND_GETFIRMWAREVERSION, 1);
    if (readackframe()) {
        sleep(10);
        // read data packet
        wirereaddata(pn532_packetbuffer, 12);

        for (var i = 0; i < 12; i++) {
            node.warn(pn532_packetbuffer[i]);
        }
        response = "The PN532 sends back the version of the embedded firmware."
    }

    return response;
}
/**************************************************************************/
/*! 
@brief  Simplified read of the firmware version of the PN5xx chip

@returns  The chip's firmware version and ID
*/
/**************************************************************************/
function easygetFirmwareVersion() {
    var PN532_COMMAND_GETFIRMWAREVERSION = 0x02;
    var PN532_PACKBUFFSIZ = 64;
    var pn532_packetbuffer = Array(PN532_PACKBUFFSIZ);
    var response = 0;
    var cmd_get_fw_version = [0x00, 0xFF, 0x02, 0xFE, 0xD4, 0x02, 0x2A];
    wirebegin();
    for (var i = 0; i < cmd_get_fw_version.length; i++) {
        wiresend(cmd_get_fw_version[i]);
    }
    if (readackframe()) {
        sleep(10);
        // read data packet
        pn532_packetbuffer = wirereaddata(pn532_packetbuffer, 12);

        for (i = 0; i < 12; i++) {
            node.warn(pn532_packetbuffer[i]);
        }
        response = "The PN532 sends back the version of the embedded firmware."
    }

    return response;
}

/**************************************************************************/
/*! 
@brief  Checks the firmware version of the PN5xx chip

@returns  The chip's firmware version and ID
*/
/**************************************************************************/
function getFirmwareVersion() {
    var pn532response_firmwarevers = [0x00, 0xFF, 0x06, 0xFA, 0xD5, 0x03];
    var PN532_COMMAND_GETFIRMWAREVERSION = 0x02;
    var PN532_PACKBUFFSIZ = 64;
    var response = 0;
    var pn532_packetbuffer = Array(PN532_PACKBUFFSIZ);
    pn532_packetbuffer[0] = PN532_COMMAND_GETFIRMWAREVERSION;
    var get_fw_version = [0x00, 0xFF, 0x02, 0xFE, 0xD4, 0x02, 0x2A];

    if (!sendCommandCheckAck(pn532_packetbuffer, 1))
        return 0;

    // read data packet
    pn532_packetbuffer = wirereaddata(pn532_packetbuffer, 12);


    response = pn532_packetbuffer[7];
    response <<= 8;
    response |= pn532_packetbuffer[8];
    response <<= 8;
    response |= pn532_packetbuffer[9];
    response <<= 8;
    response |= pn532_packetbuffer[10];

    return response;
}
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
// default timeout of one second
function sendCommandCheckAck(cmd, cmdlen) 
{
    // write the command
    wiresendcommand(cmd, cmdlen);
   
  // read acknowledgement
  if (!readackframe()) {
    this.error("No ACK frame received!");
    return false;
  }

  return true; // ack'd command
}


function sleep(milliseconds) {
    var start = new Date().getTime();
    for (var i = 0; i < 1e7; i++) {
        if ((new Date().getTime() - start) > milliseconds) {
            break;
        }
    }
}
/************** mid level I2C */

/**************************************************************************/
/*! 
@brief  Checks the IRQ pin to know if the PN532 is ready
	
@returns 0 if the PN532 is busy, 1 if it is free
*/
/**************************************************************************/
function wirereadstatus() {
    var PN532_I2C_READY = 0x01;
    var PN532_I2C_BUSY = 0x00;
    var _irq = 2;
    var x = digitalRead(_irq);
  
      if (x == 1)
        return PN532_I2C_BUSY;
      else
        return PN532_I2C_READY;
 }

 function digitalRead(irq) {
     GALILEO.digitalRead();
     return GALILEO.interrupt;
 }

/**************************************************************************/
/*! 
@brief  Tries to read the PN532 ACK frame (not to be confused with 
the I2C ACK signal)
*/
/**************************************************************************/
function readackframe() {
    var pn532ack = [0x00, 0x00, 0xFF, 0x00, 0xFF, 0x00];
    var ackbuff = [0, 0, 0, 0, 0, 0];
    var timer = 0;
    var timeout = 1000;
    var PN532_I2C_READY = 0x01;

    // Wait for chip to say its ready!
    while (wirereadstatus() != PN532_I2C_READY) {
        if (timeout != 0) {
            timer += 10;
            if (timer > timeout)
                return false;
        }
        sleep(10);
    }

    node.warn("IRQ received");
    ackbuff = wirereaddata(ackbuff, ackbuff.length);

    if (ackbuff == pn532ack) {
        return true;
    }
    return false;
}
/**************************************************************************/
/*! 
    @brief  Reads n bytes of data from the PN532 via I2C
    @param  buff      Pointer to the buffer where data will be written
    @param  len         Number of bytes to be read
*/
/**************************************************************************/
function wirereaddata(buff, len) {
  node.warn("Reading data: ");
  buff = WIRE.receivemultibyte(buff, len);
  return buff; 
}
/**************************************************************************/
/*! 
    @brief  Writes a command to the PN532, automatically inserting the
            preamble and required frame details (checksum, len, etc.)
    @param  cmd       Pointer to the command buffer
    @param  cmdlen    Command length in bytes 
*/
/**************************************************************************/
function wiresendcommand(cmd, cmdlen) {
    var checksum;
    var PN532_PREAMBLE = 0x00;
    var PN532_STARTCODE1 = 0x00
    var PN532_STARTCODE2 = 0xFF;
    var PN532_POSTAMBLE = 0x00;
    var PN532_HOSTTOPN532 = 0xD4;
    var PN532_PN532TOHOST = 0xD5;
    cmdlen++;
  
    node.warn("Sending: ");

    sleep(2);     // or whatever the delay is for waking up the board

    // I2C START
    wirebegin();
    checksum = PN532_PREAMBLE + PN532_PREAMBLE + PN532_STARTCODE2;
    node.warn("Send " + PN532_PREAMBLE); //0
    wiresend(PN532_PREAMBLE);
    node.warn("Send " + PN532_PREAMBLE); //0
    wiresend(PN532_PREAMBLE);
    node.warn("Send " + PN532_STARTCODE2); //255
    wiresend(PN532_STARTCODE2);
    node.warn("Send " + cmdlen); //2
    wiresend(cmdlen);
    node.warn("Send " + cmdlen + 1); //21
    wiresend(cmdlen + 1);
    node.warn("Send " + PN532_HOSTTOPN532); //212
    wiresend(PN532_HOSTTOPN532);
    checksum += PN532_HOSTTOPN532;

    for (var i = 0; i < cmdlen-1; i++) 
    {
       node.warn(" 0x" + cmd[i]); //0x2
       wiresend(cmd[i]);
       checksum += cmd[i];
    }
    node.warn("Send " + checksum); //469
    wiresend(checksum);
    node.warn("Send " + PN532_POSTAMBLE);
    wiresend(PN532_POSTAMBLE);
  
    // I2C STOP
    //wirestop();
} 
/**************************************************************************/
/*! 
    @brief  Sends a single byte via I2C

    @param  x    The byte to send
*/
/**************************************************************************/
function wiresend(x) 
{   
    WIRE.send(x);
}
/**************************************************************************/
/*! 
    @brief  Reads a single byte via I2C
*/
/**************************************************************************/
function wirerecv() 
{
    return WIRE.receive();
}
/**************************************************************************/
/*! 
@brief  activates the bus transfer
*/
/**************************************************************************/
function wirebegin(){
    WIRE.beginTransmission();
}
/**************************************************************************/
/*! 
@brief  stops the bus transfer
*/
/**************************************************************************/
function wirestop() {
    return WIRE.endTransmission();
}
/**************************************************************************/
/*! 
@brief  galileo abstraction 
*/
/**************************************************************************/
var GALILEO = {
    pin: 2,
    interrupt: 0,
    vendor: 0,
    value: 0,
    _mraa: require("mraa"),
    x: 0,
    digitalRead: function (_irq) {
        this.pin = _irq;
        this.vendor = this._mraa.getPlatformName();
        node.warn(this.vendor);
        this.x = new this._mraa.Gpio(parseInt(this.pin));
        this.x.mode(this._mraa.PIN_GPIO);
        this.x.dir(this._mraa.DIR_IN);
        this.x.isr(this._mraa.EDGE_BOTH, function () {
            var g = this.x.read();
            var msg = { payload: g, topic: this.board + "/D" + this.pin };
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

    beginTransmission: function () {
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

