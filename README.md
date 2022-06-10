# @parasaurolophus/node-red-eventsource

Wrap the [eventsource](https://github.com/EventSource/eventsource) module as a node.

### Inputs    

`msg.payload` is an object with one required and one optional property:   

| Property               | Description                                                                                                                       |
|------------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| `msg.payload.url`      | (Required) URL of the SSE server                                                                                                  |
| `msg.payload.initDict` | (Optional) JavaScript object representation of the `eventSourceInitDict` parameter to `new EventSource(url, eventSourceInitDict)` |

See <https://github.com/EventSource/eventsource#readme> and <https://html.spec.whatwg.org/multipage/server-sent-events.html#server-sent-events> for details.

### Outputs    

An asynchronous stream of objects, one per received server-sent event.   

### Details    

This is a deliberately minimalist implementation of the protocol and JavaScript interface underlying the standard <i>EventSource</i> feature available in modern web browsers.
It can be used, for example, to interface with the SSE based features of the [Philips Hue Bridge API V2](https://developers.meethue.com/develop/hue-api-v2/core-concepts/#events),
as demonstrated by the example flow included in this node's package.

To start receiving events, send a message with URL and configuration parameters in its payload as described above. The `EventSource` node will open a connection and begin sending  
event messages asynchronously as they are sent by the server.
