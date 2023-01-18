# PostHog SalesForce App

[![License: MIT](https://img.shields.io/badge/License-MIT-red.svg?style=flat-square)](https://opensource.org/licenses/MIT)

This is a PostHog export app. Use it to send properties from selected events to SalesForce. For example to create a lead when a customer books a demo.

## All versions

In your config provide:

-   `salesforceHost` - e.g. https://salesforce.example.io
-   `username`
-   `password`
-   `consumerKey`
-   `consumerSecret`
-   `debugLogging` - to turn on or off verbose logging

## Version 1

The first version of this app takes config:

-   `eventsToInclude`
    -   a comma separated string containing an event allow list.
    -   any event in the list will be sent to SalesForce
-   `eventPath`
    -   the path to append to the salesForceHost to make up the API URL
-   `eventMethodType` - defaults to POST

## Version 2

Allows more flexibility on where to send events.

For example:

"user signed up" event -> send to Lead
"insight analyzed" event -> send to Engagement

This version takes JSON into a strong config field `eventEndpointMapping`

This is a mapping/dictionary of event name to config object.

```
{
    "user signed up": {salesforcePath: "Lead", propertiesToInclude: "name,email,company"}
    "insight analyzed" event -> {salesforcePath: "Engagement", propertiesToInclude: "insight,user,duration"}
}
```

Each config object has a `salesforcePath`. As with the top-level `eventPath` this is appended to the `salesforceHost` to generate the API to send the event to.

And a `propertiesToInclude`. PostHog events can have a lot of properties. `propertiesToInclude` is a comman separated list of properties that should be sent to SalesForce. If the list is empty all properties are sent.

## Questions?

### [Join our Slack community.](https://join.slack.com/t/posthogusers/shared_invite/enQtOTY0MzU5NjAwMDY3LTc2MWQ0OTZlNjhkODk3ZDI3NDVjMDE1YjgxY2I4ZjI4MzJhZmVmNjJkN2NmMGJmMzc2N2U3Yjc3ZjI5NGFlZDQ)

We're here to help you with anything PostHog!
