/*
 * Request Handlers
 *
 */

// Dependencies
var config = require('./config');
var _data = require('./data');
var helpers = require('./helpers');
var stripe = require("stripe")("sk_test_3Zl8oVo4gZhrj8afPidw7sir");

// Define all the handlers
var handlers = {};

// Ping
handlers.ping = function(data,callback){
  setTimeout(function(){
    callback(200);
  },5000);

};

// Not-Found
handlers.notFound = function(data,callback){
  callback(404);
};

// Users
handlers.users = function(data,callback){
  var acceptableMethods = ['post','get','put','delete'];
  if(acceptableMethods.indexOf(data.method) > -1){
    handlers._users[data.method](data,callback);
  } else {
    callback(405);
  }
};

// Container for all the users methods
handlers._users  = {};

// Users - post
// Required data: firstName, lastName, email, password, address, tosAgreement
// Optional data: none
handlers._users.post = function(data,callback){
  // Check that all required fields are filled out
  var firstName = typeof(data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false;
  var lastName = typeof(data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false;
  var email = typeof(data.payload.email) == 'string' && data.payload.email.trim().length > 0 && helpers.validateEmail(data.payload.email.trim()) ? data.payload.email.trim() : false;
  var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
  var address = typeof(data.payload.address) == 'string' && data.payload.address.trim().length > 0 ? data.payload.address.trim() : false;
  var tosAgreement = typeof(data.payload.tosAgreement) == 'boolean' && data.payload.tosAgreement == true ? true : false;

  if(firstName && lastName && email && password && address && tosAgreement){
    // Make sure the user doesnt already exist
    _data.read('users',email,function(err,data){
      if(err){
        // Hash the password
        var hashedPassword = helpers.hash(password);

        // Create the user object
        if(hashedPassword){
          var userObject = {
            'firstName' : firstName,
            'lastName' : lastName,
            'email' : email,
            'hashedPassword' : hashedPassword,
            'address' : address,
            'tosAgreement' : true
          };

          // Store the user
          _data.create('users',email,userObject,function(err){
            if(!err){
              callback(200);
            } else {
              callback(500,{'Error' : 'Could not create the new user'});
            }
          });
        } else {
          callback(500,{'Error' : 'Could not hash the user\'s password.'});
        }

      } else {
        // User alread exists
        callback(400,{'Error' : 'A user with that email already exists'});
      }
    });

  } else {
    callback(400,{'Error' : 'Missing required fields'});
  }

};

// Required data: email
// Optional data: none
handlers._users.get = function(data,callback){
  // Check that email number is valid
  var email = typeof(data.queryStringObject.email) == 'string' && data.queryStringObject.email.trim().length > 0 && helpers.validateEmail(data.queryStringObject.email.trim()) ? data.queryStringObject.email.trim() : false;
  if(email){

    // Get token from headers
    var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
    // Verify that the given token is valid for the email
    handlers._tokens.verifyToken(token,email,function(tokenIsValid){
      if(tokenIsValid){
        // Lookup the user
        _data.read('users',email,function(err,data){
          if(!err && data){
            // Remove the hashed password from the user object before returning it to the requester
            delete data.hashedPassword;
            callback(200,data);
          } else {
            callback(404);
          }
        });
      } else {
        callback(403,{"Error" : "Missing required token in header, or token is invalid."})
      }
    });
  } else {
    callback(400,{'Error' : 'Missing required field'})
  }
};

// Required data: email
// Optional data: firstName, lastName, password, address (at least one must be specified)
handlers._users.put = function(data,callback){
  // Check for required field
  var email = typeof(data.queryStringObject.email) == 'string' && data.queryStringObject.email.trim().length > 0 && helpers.validateEmail(data.queryStringObject.email.trim()) ? data.queryStringObject.email.trim() : false;

  // Check for optional fields
  var firstName = typeof(data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false;
  var lastName = typeof(data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false;
  var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
  var address = typeof(data.payload.address) == 'string' && data.payload.address.trim().length > 0 ? data.payload.address.trim() : false;

  // Error if email is invalid
  if(email){
    // Error if nothing is sent to update
    if(firstName || lastName || password || address){

      // Get token from headers
      var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

      // Verify that the given token is valid for the email number
      handlers._tokens.verifyToken(token,email,function(tokenIsValid){
        if(tokenIsValid){

          // Lookup the user
          _data.read('users',email,function(err,userData){
            if(!err && userData){
              // Update the fields if necessary
              if(firstName){
                userData.firstName = firstName;
              }
              if(lastName){
                userData.lastName = lastName;
              }
              if(password){
                userData.hashedPassword = helpers.hash(password);
              }
              if(address){
                userData.address = address;
              }
              // Store the new updates
              _data.update('users',email,userData,function(err){
                if(!err){
                  callback(200);
                } else {
                  callback(500,{'Error' : 'Could not update the user.'});
                }
              });
            } else {
              callback(400,{'Error' : 'Specified user does not exist.'});
            }
          });
        } else {
          callback(403,{"Error" : "Missing required token in header, or token is invalid."});
        }
      });
    } else {
      callback(400,{'Error' : 'Missing fields to update.'});
    }
  } else {
    callback(400,{'Error' : 'Missing required field.'});
  }

};

// Required data: email
// Deletes user and cart associated with the user (if there is one)
handlers._users.delete = function(data,callback){
  // Check that email number is valid
  var email = typeof(data.queryStringObject.email) == 'string' && data.queryStringObject.email.trim().length > 0 && helpers.validateEmail(data.queryStringObject.email.trim()) ? data.queryStringObject.email.trim() : false;
  if(email){

    // Get token from headers
    var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

    // Verify that the given token is valid for the email
    handlers._tokens.verifyToken(token,email,function(tokenIsValid){
      if(tokenIsValid){
        // Lookup the user
        _data.read('users',email,function(err,userData){
          if(!err && userData){
            // Delete the user's data
            _data.delete('users',email,function(err){
              if(!err){
                _data.list('carts', function(err,carts){
                  if(!err && carts.indexOf(email) > -1){
                    _data.delete('carts',email,function(err){
                      if(!err){
                        callback(200, {'Message':'User and associated cart removed'});
                      } else {
                        callback(500, {'Error':'Errors while removing associated cart'});
                      }
                    });
                  } else if (!err && carts.indexOf(email) == -1) {
                    callback(200, {'Message':'User removed'});
                  } else {
                    callback(500, {'Error':'Could not list the carts'});
                  }
                })
              } else {
                callback(500,{'Error' : 'Could not delete the specified user'});
              }
            });
          } else {
            callback(400,{'Error' : 'Could not find the specified user.'});
          }
        });
      } else {
        callback(403,{"Error" : "Missing required token in header, or token is invalid."});
      }
    });
  } else {
    callback(400,{'Error' : 'Missing required field'})
  }
};

// Tokens
handlers.tokens = function(data,callback){
  var acceptableMethods = ['post','get','put','delete'];
  if(acceptableMethods.indexOf(data.method) > -1){
    handlers._tokens[data.method](data,callback);
  } else {
    callback(405);
  }
};

// Container for all the tokens methods
handlers._tokens  = {};

// Tokens - post
// Required data: email, password
// Optional data: none
handlers._tokens.post = function(data,callback){
  var email = typeof(data.payload.email) == 'string' && data.payload.email.trim().length > 0 && helpers.validateEmail(data.payload.email.trim()) ? data.payload.email.trim() : false;
  var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;

  if(email && password){
    // Lookup the user who matches that email number
    _data.read('users',email,function(err,userData){
      if(!err && userData){
        // Hash the sent password, and compare it to the password stored in the user object
        var hashedPassword = helpers.hash(password);

        if(hashedPassword == userData.hashedPassword){
          // If valid, create a new token with a random name. Set an expiration date 1 hour in the future.
          var tokenId = helpers.createRandomString(20);
          var expires = Date.now() + 1000 * 60 * 60;
          var tokenObject = {
            'email' : email,
            'id' : tokenId,
            'expires' : expires
          };

          // Store the token
          _data.create('tokens',tokenId,tokenObject,function(err){
            if(!err){
              callback(200,tokenObject);
            } else {
              callback(500,{'Error' : 'Could not create the new token'});
            }
          });

        } else {
          callback(400,{'Error' : 'Password did not match the specified user\'s stored password'});
        };

      } else { // Lookup the admin who matches that email number
        _data.read('admins',email,function(err,userData){
          if(!err && userData){
            // Hash the sent password, and compare it to the password stored in the admin object
            var hashedPassword = helpers.hash(password);

            if(hashedPassword == userData.hashedPassword){
              // If valid, create a new token with a random name. Set an expiration date 1 hour in the future.
              var tokenId = helpers.createRandomString(20);
              var expires = Date.now() + 1000 * 60 * 60;
              var tokenObject = {
                'email' : email,
                'id' : tokenId,
                'expires' : expires
              };

              // Store the token
              _data.create('tokens',tokenId,tokenObject,function(err){
                if(!err){
                  callback(200,tokenObject);
                } else {
                  callback(500,{'Error' : 'Could not create the new token'});
                }
              });
              } else {
                callback(400,{'Error' : 'Password did not match the specified user\'s stored password'});
              }
        }
      });
    }
  })} else {
    callback(400,{'Error' : 'Missing required field(s).'});
  }
};

// Tokens - get
// Required data: id
// Optional data: none
handlers._tokens.get = function(data,callback){
  // Check that id is valid
  var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
  if(id){
    // Lookup the token
    _data.read('tokens',id,function(err,tokenData){
      if(!err && tokenData){
        callback(200,tokenData);
      } else {
        callback(404);
      }
    });
  } else {
    callback(400,{'Error' : 'Missing required field, or field invalid'})
  }
};

// Tokens - put
// Required data: id, extend
// Optional data: none
handlers._tokens.put = function(data,callback){
  var id = typeof(data.payload.id) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;
  var extend = typeof(data.payload.extend) == 'boolean' && data.payload.extend == true ? true : false;
  if(id && extend){
    // Lookup the existing token
    _data.read('tokens',id,function(err,tokenData){
      if(!err && tokenData){
        // Check to make sure the token isn't already expired
        if(tokenData.expires > Date.now()){
          // Set the expiration an hour from now
          tokenData.expires = Date.now() + 1000 * 60 * 60;
          // Store the new updates
          _data.update('tokens',id,tokenData,function(err){
            if(!err){
              callback(200);
            } else {
              callback(500,{'Error' : 'Could not update the token\'s expiration.'});
            }
          });
        } else {
          callback(400,{"Error" : "The token has already expired, and cannot be extended."});
        }
      } else {
        callback(400,{'Error' : 'Specified user does not exist.'});
      }
    });
  } else {
    callback(400,{"Error": "Missing required field(s) or field(s) are invalid."});
  }
};


// Tokens - delete
// Required data: id
// Optional data: none
handlers._tokens.delete = function(data,callback){
  // Check that id is valid
  var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
  if(id){
    // Lookup the token
    _data.read('tokens',id,function(err,tokenData){
      if(!err && tokenData){
        // Delete the token
        _data.delete('tokens',id,function(err){
          if(!err){
            callback(200);
          } else {
            callback(500,{'Error' : 'Could not delete the specified token'});
          }
        });
      } else {
        callback(400,{'Error' : 'Could not find the specified token.'});
      }
    });
  } else {
    callback(400,{'Error' : 'Missing required field'})
  }
};

// Verify if a given token id is currently valid for a given user / or belongs to regular users/admin users
handlers._tokens.verifyToken = function(id,email,callback){
  // Lookup the token
  _data.read('tokens',id,function(err,tokenData){
    // continue if token present
    if(!err && tokenData){
      // continue if token not expired
      if(tokenData.expires > Date.now()){
        // in case if email is specified, check that the token is for the given user
        if(email) {
          if(tokenData.email == email){
            callback(true);
          } else {
            callback(false);
          }
        // in case if email is not specified, callback true, since token is found and its not expired
      } else {
        callback(true);
      }
    } else {
      callback(false);
    }
  } else {
    callback(false);
  }
});
}


// Verify if a given token id is currently valid and belongs to admin users
handlers._tokens.verifyTokenAdmin = function(id,callback){
  // Lookup the token
  _data.read('tokens',id,function(err,tokenData){
    if(!err && tokenData){
      // Get all admin accounts
      _data.list('admins',function(err,admins){
        // If there are no accounts then token is invalid
        if(!err && admins && admins.length > 0){

          // Otherwise check if Token.email matches any of the admin user Email
          if(admins.indexOf(tokenData.email) > -1 && tokenData.expires > Date.now()){
            callback(true);
          } else {
            callback(false);
          }
        } else {
          callback(false);
        }
      })} else {
        callback(false);
      }
  });
}


handlers._items  = {};
// Items
handlers.items = function(data,callback){
  var acceptableMethods = ['post','get','put','delete'];
  if(acceptableMethods.indexOf(data.method) > -1){
    handlers._items[data.method](data,callback);
  } else {
    callback(405);
  }
};


// Items - post. Only for admin.
// Required data: Name, Description, Category: {pizza, drink, snack, sauce}, Price, Available stock
// Optional data: none
handlers._items.post = function(data,callback){
  //Check that user is authorized
  var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

  // Verify that the given token is valid for the email of any admin user
  handlers._tokens.verifyTokenAdmin(token,function(tokenIsValid){
    if(tokenIsValid){
      // Check that all required fields are filled out
      const categories = config.categories;
      var name = typeof(data.payload.name) == 'string' && data.payload.name.trim().length > 0 ? data.payload.name.trim() : false;
      var description = typeof(data.payload.description) == 'string' && data.payload.description.trim().length > 0 ? data.payload.description.trim() : false;
      var category = typeof(data.payload.category) == 'string' && data.payload.category.trim().length > 0 && categories.indexOf(data.payload.category.trim()) > -1 ? data.payload.category.trim() : false;
      var price = typeof(data.payload.price) == 'number' && data.payload.price > 0 ? data.payload.price : false;
      var availableStock = typeof(data.payload.availableStock) == 'number' && data.payload.availableStock >= 0 && helpers.isInt(data.payload.availableStock) ? data.payload.availableStock : false;

      if(name && description && category && price && availableStock){
        // Make sure the item doesnt already exist
        _data.read('items/'+category,name,function(err,data){
          if(err){
            // Create item object
            var itemObject = {
              'name' : name,
              'description' : description,
              'category' : category,
              'price' : price,
              'availableStock' : availableStock
            };
            // Store the item
            _data.create('items/'+category,name,itemObject,function(err){
              if(!err){
                callback(200);
              } else {
                callback(500,{'Error' : 'Could not create the new item'});
              }
            });
          } else {
            // Item already exists
            callback(400,{'Error' : 'An item with that name already exists in the category'});
          };
        });

      } else {
        callback(400,{'Error' : 'Missing required fields'});
      }
    } else {
        callback(403,{"Error" : "Missing required token in header, or token is invalid."});
    }
  });
}


// Get items for any user (only authenticated)
// Use QueryString to get products of specified category, filter products by price or list all the products
// optional params: category, priceMin, priceMax
// required params: none (all products returned)
handlers._items.get = function(data,callback){
  // Get token from headers
  var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
  // Verify that the given token is valid
  handlers._tokens.verifyToken(token,false,function(tokenIsValid){
    if(tokenIsValid){
      const categories = config.categories;
      var category = typeof(data.queryStringObject.category) == 'string' && data.queryStringObject.category.trim().length > 0 ? data.queryStringObject.category.trim() : false;
      //callback an error if category was sent but is not present
      if (categories.indexOf(category) == -1 && category != false) {
        callback(200, {"Message" : "Such category does not exist"});
      }
      var priceMin = typeof(data.queryStringObject.priceMin) == 'string' && parseFloat(data.queryStringObject.priceMin) > 0 ? parseFloat(data.queryStringObject.priceMin) : false;
      var priceMax = typeof(data.queryStringObject.priceMax) == 'string' && parseFloat(data.queryStringObject.priceMax) > 0 ? parseFloat(data.queryStringObject.priceMax) : false;
      // if category is specified, then callback only products of that category
      if(category){
        let products = {};
        products = _data.readFromList('items/' + category, function(err, products){
          // if there are product in that category, then process them
          if (!err && !helpers.isEmpty(products)){
            // if priceMin or priceMax are specified, then filter the products
            if (priceMin || priceMax) {
              products = priceMin != false ? products.filter(product => product.price > priceMin) : products;
              products = priceMax != false ? products.filter(product => product.price < priceMax) : products;
              callback(200, products);
            }
            // or just callback all the products
            else {
              callback(200, products);
            }
          }
          // if products found in category, callback a message about that
          else if (!err && helpers.isEmpty(products)) {
            callback(200, {"Message" : "No products in requested category"})
          }
          // catching errors otherwise
          else {
            callback(500, err);
          }
        });
      }
      // if no category specified, then callback all of the products
      else {
        let promises = [];
        // loop through every category
        categories.forEach(function(category){
          //read all products of the category
          let promise = new Promise((resolve, reject) => {
            items = _data.readFromList('items/' + category, function(err, items){
              // if there are product in that category, then process them
              if (!err && !helpers.isEmpty(items)){
                // if priceMin or priceMax are specified, then filter the products
                if (priceMin || priceMax) {
                  items = priceMin != false ? items.filter(item => item.price > priceMin) : items;
                  items = priceMax != false ? items.filter(item => item.price < priceMax) : items;
                resolve(items);
              }
              // or just resolve all the products otherwise
              else {
                resolve(items);
              }
              // if there are no products for the category, resolve empty array
            } else if (!err && helpers.isEmpty(items)) {
              resolve([]);
            }
            // throw an error if unable to read certain category
            else {
              reject(new Error("Unable to read products of", category));
            }
          });
        });
        promises.push(promise);
      });
      // wait for all the promises to be resolved
      let products = Promise.all(promises)
      // construct a single array containing resulting products
      .then(products => {
        // if any products were resolved
        if (products.length > 0) {
          returnedProducts = [];
          // parse through each returned category' products
          products.forEach(function(category){
            // in case there are products in the category, get every product and push it to the resulting set
            if (category.length > 0){
              category.forEach(function(product){
                returnedProducts.push(product);
              });
            }
          });
          //callback the resulting set
          callback(200, returnedProducts);
        } else {
          //callback a message if there are no products
          callback(200, {"Message" : "No products in requested category"});
        }
      })
      //catching errors
      .catch(err => {
        callback(500, err);
      })
    }
  } else {
    callback(403,{"Error" : "Missing required token in header, or token is invalid."});
  }
});
}

// Delete product
// Works only for admin
// optional params: none
// required params: product category, product name
handlers._items.delete = function(data,callback){
  //Check that user is authorized
  var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

  // Verify that the given token is valid for the email of any admin user
  handlers._tokens.verifyTokenAdmin(token,function(tokenIsValid){
    if(tokenIsValid){
      // Check that all required fields are filled out
      const categories = config.categories;
      var name = typeof(data.payload.name) == 'string' && data.payload.name.trim().length > 0 ? data.payload.name.trim() : false;
      var category = typeof(data.payload.category) == 'string' && data.payload.category.trim().length > 0 && categories.indexOf(data.payload.category.trim()) > -1 ? data.payload.category.trim() : false;
      if (name && category){
        // check, if there is such a product in the Category
        _data.read('items/' + category, name, function(err, product){
          if(!err && product){
            // Delete the product
            _data.delete('items/' + category, name ,function(err){
              if(!err){
                callback(200);
              } else {
                callback(500,{'Error' : 'Could not delete the product'});
              }
            });
          } else {
            callback(400,{'Error' : 'Could not find the specified product.'});
          }
        });
      } else {
        callback(400,{'Error' : 'Missing required fields'});
      }
    } else {
      callback(403,{"Error" : "Missing required token in header, or token is invalid."});
    }
  });
}


// PUT product
// Works only for admin
// optional params: description, price, availableStock
// required params: product category, product name
handlers._items.put = function(data,callback){
  //Check that user is authorized
  var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

  // Verify that the given token is valid for the email of any admin user
  handlers._tokens.verifyTokenAdmin(token,function(tokenIsValid){
    if(tokenIsValid){
      // Check that all required fields are filled out
      const categories = config.categories;
      var name = typeof(data.payload.name) == 'string' && data.payload.name.trim().length > 0 ? data.payload.name.trim() : false;
      var category = typeof(data.payload.category) == 'string' && data.payload.category.trim().length > 0 && categories.indexOf(data.payload.category.trim()) > -1 ? data.payload.category.trim() : false;
      if (name && category){
        // Check that at least one optional field is specified
        var description = typeof(data.payload.description) == 'string' && data.payload.description.trim().length > 0 ? data.payload.description.trim() : false;
        var price = typeof(data.payload.price) == 'number' && data.payload.price > 0 ? data.payload.price : false;
        var availableStock = typeof(data.payload.availableStock) == 'number' && data.payload.availableStock >= 0 && helpers.isInt(data.payload.availableStock) ? data.payload.availableStock : false;
        if (description || price || availableStock) {
          // check, if there is such a product in the Category
          _data.read('items/' + category, name, function(err, productData){
            if(!err && productData){
              // Update the product
              if (description) {
                productData.description = description;
              }
              if (price) {
                productData.price = price;
              }
              if (availableStock) {
                productData.availableStock = availableStock;
              }
              _data.update('items/' + category, name, productData,function(err){
                if(!err){
                  callback(200, productData);
                } else {
                  callback(500,{'Error' : 'Could not update the product.'});
                }
              });
            } else {
              callback(400,{'Error' : 'Could not find the specified product.'});
            }
          });
        } else {
          callback(400,{'Error' : 'Missing fields to update.'});
        }
      } else {
        callback(400,{'Error' : 'Missing required fields.'});
      }
    } else {
      callback(403,{"Error" : "Missing required token in header, or token is invalid."});
    }
  });
}

// Container for all the carts methods
handlers._cart = {};

// Cart
handlers.cart = function(data,callback){
  var acceptableMethods = ['get','put'];
  if(acceptableMethods.indexOf(data.method) > -1){
    handlers._cart[data.method](data,callback);
  } else {
    callback(405);
  }
};


// Cart - put. Only for authenticated user.
// Method allows to add/remove products from user's cart
// In case if user does not have a cart yet, it is created
// Required data: Product Name, Product Category, Quantity
// Optional data: none
// @TODO: add available stock validation if cart with requested item already exists
handlers._cart.put = function(data,callback){
  //Check that user is authorized
  var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

  // Verify that the given token is valid for the email of any user
  handlers._tokens.verifyToken(token,false,function(tokenIsValid){
    if(tokenIsValid){
      // Check that all required fields are filled out
      const categories = config.categories;
      var name = typeof(data.payload.name) == 'string' && data.payload.name.trim().length > 0 ? data.payload.name.trim() : false;
      var category = typeof(data.payload.category) == 'string' && data.payload.category.trim().length > 0 && categories.indexOf(data.payload.category.trim()) > -1 ? data.payload.category.trim() : false;
      // Quantity can be negative - to reduce the number of products in the cart
      var quantity = typeof(data.payload.quantity) == 'number' && data.payload.quantity != 0 && helpers.isInt(data.payload.quantity) ? data.payload.quantity : false;

      if(name && category && quantity){
        //make sure that such a product exists
        _data.read('items/'+category,name,function(err,productData){
          if(!err){
            //Check, if requested quantity <= availableStock
            if(quantity <= productData.availableStock){
              // Get user e-mail
              _data.read('tokens',token,function(err,tokenData){
                if(!err){
                  let userEmail = tokenData.email;
                  // Check if there's such a user
                  _data.read('users',userEmail,function(err,userData){
                    if(!err && userData){
                      // Create an item for product
                      let productToCart = {
                        'name' : name,
                        'category' : category,
                        'price' : productData.price, // price is denormalized to the cart because it may change in the future
                        'quantity' : quantity
                      };
                      // Check if there's an active cart for that user
                      _data.list('carts', function(err,carts){
                        if(!err && carts.indexOf(userEmail) > -1){
                          // There is a cart found for the user - check what this cart contains
                          _data.read('carts',userEmail,function(err,cartData){
                            if(!err && cartData){
                              // filter only a product item with the same <category;name> as the one that is passes to the function
                              let filteredData = cartData.filter(cartItem => cartItem.category == productToCart.category && cartItem.name == productToCart.name);
                              // if the cart already contains the item from request, then update this item in the cart
                              if(filteredData.length == 1){
                                // update quantity
                                cartData[cartData.indexOf(filteredData[0])].quantity += productToCart.quantity;
                                // update price for the product because it could be changed since the last version
                                cartData[cartData.indexOf(filteredData[0])].price = productToCart.price;
                                // check the fields are vaild
                                if(cartData[cartData.indexOf(filteredData[0])].quantity < 0) {
                                  callback(500,{'Error' : 'Could not update the cart - total quantity is negative'});
                                } else {
                                  // if quantity of a product in the cart becomes equal to 0 - remove it from the cart
                                  if(cartData[cartData.indexOf(filteredData[0])].quantity == 0) {
                                      cartData.splice(cartData.indexOf(filteredData[0]),1);
                                  };
                                  // write updated cart to the file and callback the cart
                                  _data.update('carts', userEmail, cartData ,function(err){
                                    if(!err){
                                      callback(200,cartData);
                                    } else {
                                      callback(500,{'Error' : 'Could not update the cart.'});
                                    }
                                  });
                                }
                              } else {
                                // In case there is a cart but it does not contain the product from request
                                if(productToCart.quantity < 1) {
                                  // saving negative quantity is forbidden
                                  callback(500,{'Error' : 'Could not update the cart - quantity less than 1'});
                                } else {
                                  // if cart does not contain the item, add a new item to the cart
                                  cartData.push(productToCart);
                                  _data.update('carts', userEmail, cartData,function(err){
                                    if(!err){
                                      callback(200, cartData);
                                    } else {
                                      callback(500,{'Error' : 'Could not update the cart.'});
                                    }
                                  });
                                }
                              }
                            } else {
                              callback(500, {'Error':'Internal Server Error occured while reading the cart'});
                            }
                          });
                        }
                        // in case there is no cart - create it
                        else if (!err && carts.indexOf(userEmail) == -1) {
                          console.log('There is no cart');
                          // Create an empty cart with a product in it
                          let finalCart = [];
                          finalCart.push(productToCart);
                          _data.create('carts', userEmail, finalCart, function(err){
                            if(!err) {
                              callback(200,finalCart);
                            } else {
                              callback(500,{'Error' : 'Internal server error occured while creating a new cart'});
                            }
                          });
                        } else {
                          callback(500,{'Error' : 'Internal server error occured while reading carts'});
                        }
                      })
                    } else {
                      callback(500,{'Error' : 'Internal server error occured while reading user'});
                    }
                  });
                } else {
                  callback(500,{'Error' : 'Internal server error occured while reading token'});
                }
              });
            } else {
              // There is no that many items available on Stock
              callback(400,{'Error' : 'Requested quantity is more that available Stock'});
            }
          } else {
            // Item doesn't exist
            callback(400,{'Error' : 'There is no such product in category'});
          }
        });
      } else {
        callback(400,{'Error' : 'Missing required fields'});
      }
    } else {
        callback(403,{"Error" : "Missing required token in header, or token is invalid."});
    }
  });
}

// Cart - get. Only for authenticated user.
// Required data: token
// Optional data: none
handlers._cart.get = function(data,callback){
  //Check that user is authorized
  var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

  // Verify that the given token is valid for the email of any admin user
  handlers._tokens.verifyToken(token,false,function(tokenIsValid){
    if(tokenIsValid){
      _data.read('tokens',token,function(err, tokenData){
        if(!err && tokenData){
          // read the user
          let email = tokenData.email;
          _data.read('users',email,function(err, userData){
            if(!err){
              _data.list('carts', function(err,carts){
                if(!err && carts.indexOf(email) > -1){
                  _data.read('carts',email,function(err, cartData){
                    if(!err && cartData) {
                      callback(200, cartData);
                    } else if (!err && cartData.isEmpty() == true) {
                      callback(200, {'Message':'Cart is empty'});
                    } else {
                      callback(500, {'Error':'Could not read the cart'});
                    }
                  });
                } else if (!err && carts.indexOf(email) == -1){
                  callback(200, {'Message':'There is no cart for the user'});
                } else {
                  callback(500, {'Error':'Could not get the cart'});
                }
              });
            } else {
              callback(500, {'Error':'Could not read the user'});
            }
          });
        } else {
          callback(500,{"Error" : "Could not resolve token data"});
        }
      });
    } else {
      callback(403,{"Error" : "Missing required token in header, or token is invalid."});
    }
  });
};


// Container for all the order methods
handlers._order = {};

// Cart
handlers.order = function(data,callback){
  var acceptableMethods = ['get','post'];
  if(acceptableMethods.indexOf(data.method) > -1){
    handlers._order[data.method](data,callback);
  } else {
    callback(405);
  }
};

handlers._order.post = function(data,callback){
  //Check that user is authorized
  var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

  // Verify that the given token is valid for the email of any admin user
  handlers._tokens.verifyToken(token,false,function(tokenIsValid){
    if(tokenIsValid){
      _data.read('tokens',token,function(err, tokenData){
        if(!err && tokenData){
          // read the user
          let email = tokenData.email;
          _data.read('users',email,function(err, userData){
            if(!err){
              //get uset data for order
              let lastName = userData.lastName;
              let firstName = userData.firstName;
              // lookup user cart
              _data.list('carts', function(err,carts){
                if(!err && carts.indexOf(email) > -1){
                  // read the cart
                  _data.read('carts',email,function(err, cartData){
                    // if cart is not empty, place an order
                    if(!err && helpers.isEmpty(cartData) == false) {
                      // check that product quanity in cart is still available on stock
                      helpers.validateCart(cartData, function(err){
                        if(!err){
                          // if stock is available - calculate total amount
                          helpers.calculateCartAmount(cartData, function(amount){
                            // if successful - charge user
                            if(amount) {
                              stripe.charges.create({
                                amount: amount,
                                currency: "usd",
                                source: "tok_visa", // obtained with Stripe.js
                                description: "PizzaSite: Charge for " + firstName + " " + lastName
                              }, function(err, charge) {
                                if(!err){
                                  // if successful - call several actions in parallel:
                                  // remove the cart file...
                                  _data.delete('carts', email, function(err){
                                    if(err){
                                      console.log("Error while removing cart:", err);
                                    }
                                  });
                                  // create order Object and save it to a file...

                                  let order = {};
                                  let date = new Date;
                                  order.amount = amount;
                                  order.date = date;
                                  order.userData = userData;
                                  order.cartData = cartData;
                                  order.charge = charge;


                                  _data.create('orders', email+'_'+date, order, function(err){
                                    if(err){
                                      console.log("Error while creating order:", err);
                                    }
                                  });

                                  // reduce AvailableStock of products from Order...
                                  helpers.processCart(cartData, function(err, errMessage){
                                    if(err){
                                      console.log(errMessage);
                                    }
                                  });

                                  // callback
                                  callback(200, {'status':'successful', 'charge':charge});

                                  // send a receipt via Mailgun
                                  helpers.sendReceipt(order, function(err){
                                    if(err){
                                      console.log('Error while sending receipt', err)
                                    } else {
                                      console.log('Receipt sent');
                                    }
                                  })

                              } else {
                                callback(500, err);
                              }
                              });
                            } else {
                              callback(500, {'Error':'Internal error'});
                            }
                          });
                          // if theres not enough stock - return which products are missing
                        } else {
                          callback(500, err);
                        }
                      });
                    } else if (!err && cartData.isEmpty() == true) {
                      callback(200, {'Message':'Cart is empty'});
                    } else {
                      callback(500, {'Error':'Could not read the cart'});
                    }
                  });
                } else if (!err && carts.indexOf(email) == -1){
                  callback(200, {'Message':'There is no cart for the user'});
                } else {
                  callback(500, {'Error':'Could not get the cart'});
                }
              });
            } else {
              callback(500, {'Error':'Could not read the user'});
            }
          });
        } else {
          callback(500,{"Error" : "Could not resolve token data"});
        }
      });
    } else {
      callback(403,{"Error" : "Missing required token in header, or token is invalid."});
    }
  });
};

// Export the handlers
module.exports = handlers;
