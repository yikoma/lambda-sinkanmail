"use strict";

const AWS = require('aws-sdk');
const SES = new AWS.SES({
    apiVersion: '2010-12-01',
    region: 'us-west-2'
});
const Cheerio = require('cheerio');
const RequestPromise = require('request-promise');
const DateWithOffset = require('date-with-offset');

const program = 'lambda-sinkanmail';
const toAddress = [process.env.toAddress];
const fromAddress = program + ' <' + process.env.fromAddress + '>';
//const fromAddress = process.env.fromAddress;

let books = [];

const fetchOptions = {
    uri: process.env.sinkanRssUrl,
    transform: function(body) {
        let $ = Cheerio.load(body ,{xmlMode : true});
        $("channel > item").each(function(i) {
            books[i] = {title: $(this).find("title").text()};
            console.log(JSON.stringify(books[i]));
        });
    }
};

function createSesParams() {
    let body;
    if (books.length > 0) {
        body = books.map(function(value, index, array) {
            return value.title;
        }).join("\n") + "\n";
    } else {
        body = "新刊なし\n";
    }
    body += "\nby " + program;

    let now = new DateWithOffset(9 * 60);
    let subject = 'sinkanmail (' + now.getFullYear() + '/' + (now.getMonth() + 1) + '/' + now.getDate() + ')';

    return {
        Destination: {
            ToAddresses: toAddress
        },
        Message: {
            Body: {
                Text: {
                    Data: body,
                    Charset: 'iso-2022-jp'
                }
            },
            Subject: {
                Data: subject,
                Charset: 'iso-2022-jp'
            }
        },
        Source: fromAddress
    };
}

exports.handler = (event, context, callback) => {
    console.log(process.env);
    RequestPromise(fetchOptions).then(function($) {
        console.log("start sendEmail");
        SES.sendEmail(createSesParams(), function(err, data) {
            if (err) {
                console.log("===EMAIL ERROR===");
                console.log(err);
                context.fail(new Error('mail error occured'));
            } else {
                console.log("===EMAIL SENT===");
                console.log(data);
                context.succeed('success');
            }
        });
    }).catch(function(err) {
        console.log("===FETCH ERROR===");
        console.log(err);
        context.fail(new Error('fetch error occured'));
    });
};
