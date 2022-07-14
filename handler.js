"use strict";
const aws = require("aws-sdk");
const cwl = new aws.CloudWatchLogs({
  apiVersion: "2014-03-28",
  region: "us-east-1",
});
const ses = new aws.SES({ region: "us-east-1" });

let generateEmailContent = (data, message) => {
  let events = data.events;
  console.log("Events are:", events);
  let logData = JSON.stringify(events);

  let date = new Date(message.StateChangeTime);
  let text = "<table border='1'>";
  text +=
    "<tr><td>Log Level</td><td>Message</td><td>Microservice</td><td>Stack Tracle</td><td>Time Stamp</td></tr>";
  for (let i = 0; i < events.length; i++) {
    const data = JSON.parse(events[i].message);
    text += `<tr><td>${data.level}</td><td>${data.message}</td><td>${data.service}</td><td>${data.stack}</td><td>${data.timestamp}</td></tr>`;
  }
  text += "</table>";
  //console.log(text);
  let htmlData = `<html>
  <head>
  <style>
  table, th, td {
    border: 1px solid black;
    border-collapse: collapse;
  }
  </style>
    <title>Error Logs</title>
  </head>
  <body>
  
  <div>${text}</div>
  
  </body>
  </html>`;
  let subject = `Logs Details For The ALARM`;

  let emailContent = {
    Destination: {
      CcAddresses: ["praveen.dung@mach49.com", "akhil.reddy@mach49.com"],
      ToAddresses: ["khurrum.ali@mach49.com"],
    },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: htmlData,
        },
        Text: {
          Charset: "UTF-8",
          Data: `${logData}`,
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: `${subject}`,
      },
    },
    Source: "khurrum.ali@mach49.com",
    SourceArn:
      "arn:aws:ses:us-east-1:623776086239:identity/khurrum.ali@mach49.com",
    Tags: [
      {
        Name: "sender",
        Value: "Khurrum",
      },
    ],
  };

  return emailContent;
};

const getLogsAndSendEmail = (message, metricFilterData) => {
  const timestamp = Date.parse(message.StateChangeTime);
  const offset =
    message.Trigger.Period * message.Trigger.EvaluationPeriods * 1000;
  console.log("timestamp:=", timestamp);
  console.log("offset:=", offset);
  const metricFilter = metricFilterData.metricFilters[0];
  const parameters = {
    logGroupName: metricFilter.logGroupName,
    filterPattern: metricFilter.filterPattern ? metricFilter.filterPattern : "",
    startTime: timestamp - offset,
    endTime: timestamp,
  };
  console.log(metricFilter);
  console.log(parameters);
  cwl.filterLogEvents(parameters, (err, data) => {
    if (err) {
      console.log("Filtering failure:", err);
    } else {
      console.log(data);
      ses.sendEmail(generateEmailContent(data, message), (err, data) => {
        if (err) console.log(err);
        else console.log(data);
      });
    }
  });
};

module.exports.dispatchErrors = (event, context, cb) => {
  console.log(JSON.stringify(event));
  console.log(JSON.stringify(context));
  console.log(JSON.stringify(cb));
  context.callbackWaitsForEmptyEventLoop = false;
  const message = JSON.parse(event.Records[0].Sns.Message);
  const requestParams = {
    metricName: message.Trigger.MetricName,
    metricNamespace: message.Trigger.Namespace,
  };
  console.log(requestParams);
  console.log(message);
  cwl.describeMetricFilters(requestParams, (err, data) => {
    if (err) {
      console.log("Error occured:", err);
    } else {
      getLogsAndSendEmail(message, data);
    }
  });
};
