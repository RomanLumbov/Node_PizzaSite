/*
 * Helpers for various tasks
 *
 */

// Dependencies
const config = require('./config');
const crypto = require('crypto');
const https = require('https');
const querystring = require('querystring');

// Container for all the helpers
var helpers = {};

// Compares provided string with a regular expression in order to check whether it is a valid email or not
helpers.validateEmail = function(email){
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

// Parse a JSON string to an object in all cases, without throwing
helpers.parseJsonToObject = function(str){
  try{
    var obj = JSON.parse(str);
    return obj;
  } catch(e){
    return {};
  }
};

// Check empty object
helpers.isEmpty = function(obj) {
    return Object.keys(obj).length === 0;
}

helpers.isInt = function(n){
   return n % 1 === 0;
};

// Create a SHA256 hash
helpers.hash = function(str){
  if(typeof(str) == 'string' && str.length > 0){
    var hash = crypto.createHmac('sha256', config.hashingSecret).update(str).digest('hex');
    return hash;
  } else {
    return false;
  }
};

// Create a string of random alphanumeric characters, of a given length
helpers.createRandomString = function(strLength){
  strLength = typeof(strLength) == 'number' && strLength > 0 ? strLength : false;
  if(strLength){
    // Define all the possible characters that could go into a string
    var possibleCharacters = 'abcdefghijklmnopqrstuvwxyz0123456789';

    // Start the final string
    var str = '';
    for(i = 1; i <= strLength; i++) {
        // Get a random charactert from the possibleCharacters string
        var randomCharacter = possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length));
        // Append this character to the string
        str+=randomCharacter;
    }
    // Return the final string
    return str;
  } else {
    return false;
  }
};

helpers.sendTwilioSms = function(email,msg,callback){
  // Validate parameters
  email = typeof(email) == 'string' && email.trim().length == 10 ? email.trim() : false;
  msg = typeof(msg) == 'string' && msg.trim().length > 0 && msg.trim().length <= 1600 ? msg.trim() : false;
  if(email && msg){

    // Configure the request payload
    var payload = {
      'From' : config.twilio.fromemail,
      'To' : '+1'+email,
      'Body' : msg
    };
    var stringPayload = querystring.stringify(payload);


    // Configure the request details
    var requestDetails = {
      'protocol' : 'https:',
      'hostname' : 'api.twilio.com',
      'method' : 'POST',
      'path' : '/2010-04-01/Accounts/'+config.twilio.accountSid+'/Messages.json',
      'auth' : config.twilio.accountSid+':'+config.twilio.authToken,
      'headers' : {
        'Content-Type' : 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(stringPayload)
      }
    };

    // Instantiate the request object
    var req = https.request(requestDetails,function(res){
        // Grab the status of the sent request
        var status =  res.statusCode;
        // Callback successfully if the request went through
        if(status == 200 || status == 201){
          callback(false);
        } else {
          callback('Status code returned was '+status);
        }
    });

    // Bind to the error event so it doesn't get thrown
    req.on('error',function(e){
      callback(e);
    });

    // Add the payload
    req.write(stringPayload);

    // End the request
    req.end();

  } else {
    callback('Given parameters were missing or invalid');
  }
};

helpers.calculateCartAmount = function(cart, callback){
  if (typeof(cart) == 'object' && helpers.isEmpty(cart) === false) {
    let amount = 0;
    cart.forEach(function(item){
      amount += item.price * item.quantity;
    });
    callback(amount.toFixed(2) * 100);
  } else {
    callback(false);
  }
};

helpers.validateCart = function(cart, callback){
  // ! if I declare _data on top in depencies section, _data.read becomes undefined for some reason I don't know
  const _data = require('./data');
  // check if cart valid
  if (typeof(cart) == 'object' && helpers.isEmpty(cart) === false) {
    let errMessage = [];
    let promises = [];
    // loop through the cart
    cart.forEach(function(item){
      let promise = new Promise((resolve, reject) => {
        // read matching products from storage
        return _data.read('items/'+item.category,item.name,(err, product) =>
        {
          if (err != false) {
            reject({'Error:':'Cannot read product data'});
          } else if (product.availableStock < item.quantity) {
            // if available stock is less then requested quantity - callback error
            reject({'Error:':'Product stock is low:' + product.name + ' ' + product.availableStock});
          } else {
            // otherwise - resolve promise
            resolve(true);
          }
        });
       });
      promises.push(promise);
    });
    let products = Promise.all(promises)
      .then(value => {
        // if everything is good - callback false
        callback(false);
      })
      // otherwise - callback an error
      .catch(err => callback(err))
  } else {
    callback({'Error:':'Unsupported cart format'});
  }
};

helpers.processCart = async function(cart, callback){
  // ! if I declare _data on top in depencies section, _data.read becomes undefined for some reason I don't know
  const _data = require('./data');
  // check if cart valid
  if (typeof(cart) == 'object' && helpers.isEmpty(cart) === false) {
    let err = false;
    let errMessage = [];
    // loop through the cart
    await cart.forEach(function(item){
      _data.read('items/'+item.category,item.name,function(err, product){
        if(!err && product){
          // check that there is enough stock
          if(product.availableStock < item.quantity) {
            err = true;
            errMessage.push({'Error':'Not enough stock for ' + item.name});
          } else {
            // if stock available - reduce it accordingly
            product.availableStock -= item.quantity;
            _data.update('items/'+product.category,product.name,product,function(err){
              if(err){
                err = true;
                errMessage.push({'Error':'Unable to update ' + item.name});
              } else {
                // if everything is fine - logout the final item
                console.log(item);
              }
            });
          }
        } else {
          err = true;
          errMessage.push({'Error':'Unable to read product ' + item.name});
        }
      });
    });
    callback(err, errMessage);
  } else {
    callback(true, {'Error':'Unsupported cart format'});
  }
};


// Mailgun emailer
// Required data - order object
// Returns either false is email was sent or error otherwise
helpers.sendReceipt = function(order, callback){
  if(typeof(order)==='object'){
    let cartString = ''
    order.cartData.forEach(function(item){
      cartString += item.name + ' x ' + item.quantity + ', ' + item.price + '\n';
    });
    let mailData = {
      from: 'PizzaSite <PizzaSite@samples.mailgun.org>',
      to: order.userData.email,
      subject: 'Receipt for your purchase',
      text: 'Hello, ' + order.userData.firstName + ' ' + order.userData.lastName + '!\n' + 'Here is your receipt:\n' +
      'Date: ' + order.date + '\n' +
      'Transaction: ' + order.charge.balance_transaction + '\n' +
      '\n' + 'Product information:' + '\n' +
      cartString + '\n' +
      'Amount: ' + order.amount/100 + ' ' + order.charge.currency + '\n' +
      'Thank you for purchase!' + '\n' +
      '\n' +
      'If you have any questions, please call us at +777777777'
    };
    var mailDataString = querystring.stringify(mailData);
    var requestDetails = {
        'protocol': 'https:',
        'hostname': 'api.mailgun.net',
        'path': '/v3/' + config.mailgunDomain + '/messages',
        'method': 'POST',
        'auth': 'api:' + config.mailgunApiKey,
        'headers': {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(mailDataString)
        }
      }
      var req = https.request(requestDetails, (res) => {
        if (res.statusCode == 200 || res.statusCode == 201) {
          callback(false)
        } else {
          callback('Problem with sending request to mailgun, status:' + res.statusCode);
        }
      });
      req.on('error', (e) => {
        callback(e);
      });
      req.write(mailDataString);
      req.end();
  } else {
    callback('Order format is not supported');
  }
};

// Stripe charges
// Required data - chargeData
// Returns either Stripe API successful response or request error
helpers.charge = function(chargeData, callback){
  // check data
  if(chargeData.amount > 0 && chargeData.currency && chargeData.source && chargeData.description){
    let request = new Promise((resolve, reject) => {
      chargeData = querystring.stringify(chargeData);
      // set request details
      let options = {
        'method' : 'POST',
        'protocol' : 'https:',
        'hostname' : 'api.stripe.com',
        'path' : '/v1/charges',
        'auth': config.stripeApiKey,
        'headers' : {
          "Content-Type" : 'application/x-www-form-urlencoded',
          "Content-Length" : Buffer.byteLength(chargeData),
        }
      }
      // make a request
      req = https.request(options, (res) => {
        // if statusCode is succesfull - get the data from responce and call it back
        if (res.statusCode == 200 || res.statusCode == 201){
        res.on('data', (data) => {
          resolve(data);
        });
        // otherwise - callback an error
      } else {
        reject(res);
        }
      });

      req.on('error',function(err){
        reject(err);
        console.log('Charge Request Error:', err)
      })
      req.write(chargeData);
      req.end();
    })
    .then(resData => callback(false, JSON.parse(resData)))
    .catch(error => callback(true, error))
  } else {
    callback(true, 'Unsupported charge object');
  }
}

// Export the module
module.exports = helpers;
