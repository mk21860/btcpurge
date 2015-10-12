var express = require('express');
var router = express.Router();
var app = require('../app.js');
var address = require('bitcoin-address');
var qr = require('qr-js');



// The above is all rpc setup that is needed to be done in order to generate new addresses for the transaction
var client = app.getClient();

var db = app.getDb();

var capthca = app.getCaptcha();



var addr = null; //start as null and always set back to null (security issue)



function getaccountaddress(acc, callback) {
    client.call({
            "method": "getaccountaddress",
            "params": [acc.toString()]
        },
        function(err, res) {
            // Did it all work ?
            if (err) {
                console.log(err);
            } else {
                //if addr was generate successfully log it and return the address
                addr = res.result;
                console.log("new address generated for account: " + acc + " address: " + res.result);
            }
        }
    );
}

/* GET home page. */
router.get('/', function(req, res) {
    var collection = db.get('btce');
    collection.findOne({}, {
        fields: {
            btc_usd: 1
        }
    }, function(e, docs) {
        if (e) {
            // If it failed, return error
            console.log("ERROR");
            res.send("There was a problem searching the information in the database.");
        } else {
            if (docs == null) {
                console.log("Thread 2: nothing in the confirmed db");
            } else {
                res.render('newtx', {
                    title: 'Submit a new transaction',
                    btc_usd: docs.btc_usd
                });
            }
        }

    });

});


/* GET Hello World page. */
router.get('/helloworld', function(req, res) {
    res.render('helloworld', {
        title: 'Hello, World!'
    })
});


/* GET TXlist page. */
router.get('/txlist', function(req, res) {
    var collection = db.get('btce');
    collection.findOne({}, {
        fields: {
            btc_usd: 1
        }
    }, function(e, docs) {
        if (e) {
            // If it failed, return error
            console.log("ERROR");
            res.send("There was a problem searching the information in the database.");
        } else {
            if (docs == null) {
                console.log("Thread 2: nothing in the btce db");
            } else {
                
                var collection = db.get('txs');
                // search the DB
                collection.findOne({
                    "addr": addr.toString()
                }, {
                    fields: { //not required used for debugging purposes
                        sendto: 1
                    }
                }, function(err, doc) {
                    if(doc == null) {
                           res.render('txlist', {
                                scripts: ['../public/javascripts/qr.min.js']

                            });

                    }else{

                    var curDate = new Date().toISOString().replace(/T/, ' ').  replace(/\..+/, '');
                    var receipt = "btcpurge has generated this deposit address: " + addr + " and guarantees to forward mixed coins to this address: " + doc.sendto + " deposits will be valid for 24 hours starting from " + curDate.toString() + " EDT";
                    client.call({
                            "method": "signmessage",
                            "params": ['18z9yJh8drg9bQiupQHHyiHaChP7DekB7Y', receipt.toString()]
                        },
                        function(err, ress) {
                            var finalMessage = "----BEGIN BITCOIN SIGNED MESSAGE 18z9yJh8drg9bQiupQHHyiHaChP7DekB7Y----" + receipt + "----END BITCOIN SIGNED MESSAGE---- ----BEGIN DIGITAL SIGNATURE----" + ress.result + "----END DIGITAL SIGNATURE----";
                            
                            res.render('txlist', {
                                title: 'Unconfirmed',
                                addr: addr,
                                conf: 0,
                                btc_usd: docs.btc_usd,
                                message: finalMessage,
                                scripts: ['../public/javascripts/qr.min.js']

                            });
                            addr = "";

                        });
                    }
                });

            }
        }

    });

});

/* GET New User page. */
router.get('/newtx', function(req, res) {
    var collection = db.get('btce');
    collection.findOne({}, {
        fields: {
            btc_usd: 1
        }
    }, function(e, docs) {
        if (e) {
            // If it failed, return error
            console.log("ERROR");
            res.send("There was a problem searching the information in the database.");
        } else {
            if (docs == null) {
                console.log("Thread 2: nothing in the confirmed db");
            } else {
                res.render('newtx', {
                    title: 'Submit a new transaction',
                    btc_usd: docs.btc_usd
                });
            }
        }

    });

});

/* GET QRCode.js page. */
router.get('/qrcode', function(req, res) {
    res.render('', {
        title: 'qrcode'
    });
});

/* GET New Explanation page. */
router.get('/how', function(req, res) {
    var collection = db.get('btce');
    collection.findOne({}, {
        fields: {
            btc_usd: 1
        }
    }, function(e, docs) {
        if (e) {
            // If it failed, return error
            console.log("ERROR");
            res.send("There was a problem searching the information in the database.");
        } else {
            if (docs == null) {
                console.log("Thread 2: nothing in the confirmed db");
            } else {
                res.render('how', {
                    title: 'Explanation',
                    btc_usd: docs.btc_usd
                });
            }
        }

    });
});

/* GET FAQ page. */
router.get('/faq', function(req, res) {
    var collection = db.get('btce');
    collection.findOne({}, {
        fields: {
            btc_usd: 1
        }
    }, function(e, docs) {
        if (e) {
            // If it failed, return error
            console.log("ERROR");
            res.send("There was a problem searching the information in the database.");
        } else {
            if (docs == null) {
                console.log("Thread 2: nothing in the confirmed db");
            } else {
                res.render('faq', {
                    title: 'FAQ',
                    btc_usd: docs.btc_usd
                });
            }
        }

    });
});

/* GET TOS page. */
router.get('/tos', function(req, res) {
    var collection = db.get('btce');
    collection.findOne({}, {
        fields: {
            btc_usd: 1
        }
    }, function(e, docs) {
        if (e) {
            // If it failed, return error
            console.log("ERROR");
            res.send("There was a problem searching the information in the database.");
        } else {
            if (docs == null) {
                console.log("Thread 2: nothing in the confirmed db");
            } else {
                res.render('tos', {
                    title: 'TOS',
                    btc_usd: docs.btc_usd
                });
            }
        }

    });
});


/* GET New AddrError page. */
router.get('/addrerror', function(req, res) {
    res.render('addrerror', {
        title: 'SendTo Address Error'
    });
});

/* GET New TosError page. */
router.get('/toserror', function(req, res) {
    res.render('toserror', {
        title: 'Terms Of Service Agreement Error'
    });
});

/* GET New User page. */
router.get('/contact', function(req, res) {
    var collection = db.get('btce');
    collection.findOne({}, {
        fields: {
            btc_usd: 1
        }
    }, function(e, docs) {
        if (e) {
            // If it failed, return error
            console.log("ERROR");
            res.send("There was a problem searching the information in the database.");
        } else {
            if (docs == null) {
                console.log("Thread 2: nothing in the confirmed db");
            } else {
                res.render('contact', {
                    title: 'Contact',
                    btc_usd: docs.btc_usd
                });
            }
        }

    });



});

//needed to generate random number

function randomInt(low, high) {
    return Math.floor(Math.random() * (high - low) + low);
}


router.post('/submitted', function(req, res) {
    var name = req.body.contactName;
    var email = req.body.contactEmail;
    var content = req.body.inquiry;
    //check captcha
 if(req.body.captchaAnswer == req.session.captcha){

    var collection = db.get('contact');
    collection.insert({
        "name": name.toString(),
        "email": email.toString(),
        "content": content.toString()

    }, function(err, doc) {
        if (err) {
            // If it failed, return error
            res.send("There was a problem adding the information to the database.");
        } else {
            // If it worked
            res.render('success', {
                title: 'Success'
            });

        }

    });
  }else{
    res.render('contact', {
                title: 'Captcha Error'
            });

  }

});

/* POST to Add User Service */
router.post('/addtx', function(req, res) {
    console.log("request is: ");
    console.log(req.body.tos);
    if (req.body.tos == null) {
        res.location("toserror");
        res.redirect("toserror");
    } else if (req.body.tos.toString() === "on"){

        // Set our internal DB variable
        var db = req.db;

        // Get our form values. These rely on the "name" attributes
        var sendTo = req.body.sendTo;
        var timeDelay = req.body.timeDelay;
        var splitAmount = req.body.splitAmount;
        var feePercent = req.body.feePercent;

        //generate the random 5 digit token
        var token = randomInt(10000, 99999);

        //generate the custom address with the token as the account


        //at this point we should have a token, address, amount, and sendTo
        //address is stored in addr variable

        if (address.validate(sendTo, 'prod')) { //if sendTo address valid
            client.call({
                    "method": "getaccountaddress",
                    "params": [token.toString()]
                },
                function(err, ress) {
                    // Did it all work ?
                    if (err) {
                        console.log(err);
                    } else {
                        //if addr was generate successfully log it and return the address
                        addr = ress.result;
                        console.log("new address generated for account: " + token + " address: " + ress.result);

                        // Set our collection
                        var collection = db.get('txs');
                        var serverTime = app.getServerTime();
                        // Submit to the DB
                        collection.insert({
                            "token": token,
                            "addr": addr.toString(),
                            "sendto": sendTo.toString(),
                            "timeDelay": timeDelay,
                            "splitAmount": splitAmount,
                            "feePercent": feePercent,
                            "timeInserted": serverTime
                        }, function(err, doc) {
                            if (err) {
                                // If it failed, return error
                                res.send("There was a problem adding the information to the database.");
                            } else {
                                // If it worked, set the header so the address bar doesn't still say /addtx
                                res.location("txlist");
                                // And forward to success page
                                res.redirect("txlist");
                            }
                        });

                    }
                }
            );
        } else { //if sendTo address is not valid then 
            res.location("addrerror");
            res.redirect("addrerror");
        }
    }

});



module.exports = router;