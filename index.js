var fs = require("fs");
var mkdirp = require("mkdirp");
var async = require("async");
var request = require("request");
var mongodb = require("mongodb").MongoClient;
var ig = require("instagram-node").instagram();
var config = require("./config/config");

ig.use(config.auth);

mongodb.connect(config.db, function(err, db) {
    if (err) {
        throw err;
    }

    var handleResults = function(err, images, page) {
        async.eachLimit(images, 4, function(image, callback) {
            var url = image.images.low_resolution.url;
            var dir = __dirname + "/images/" +
                image.id.replace(/^(\w)(\w)(\w).*$/, "$1/$2/$3");
            var file = dir + "/" + image.id + ".jpg";

            if (fs.exists(file)) {
                callback();
            } else {
                mkdirp(dir, function() {
                    request(url)
                        .pipe(fs.createWriteStream(file))
                        .on("close", callback);
                });
            }

            image._id = image.id;
            console.log("Downloading:", image.id);
        }, function() {
            console.log("Saving to DB.");
            db.collection(config.collection).insert(images, function(err) {
                if (err) {
                    console.log("ERROR", err);
                }

                console.log("Done.");

                if (page) {
                    // 1s delay to avoid hitting the rate limit
                    setTimeout(function() {
                        page.next(handleResults);
                    }, 1000);
                } else {
                    process.exit(0);
                }
            });
        });
    };

    ig.tag_media_recent(config.tag, handleResults);
});
