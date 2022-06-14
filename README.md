# @parasaurolophus/node-red-eventsource

Wrap the [eventsource](https://github.com/EventSource/eventsource) package as a node.

See <https://github.com/EventSource/eventsource#readme> and <https://html.spec.whatwg.org/multipage/server-sent-events.html#server-sent-events> for details.

### Inputs

`msg.payload` must be an object with one required and one optional property:

| Property               | Description                                                                                                                       |
|------------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| `msg.payload.url`      | (Required) URL of the SSE server                                                                                                  |
| `msg.payload.initDict` | (Optional) JavaScript object representation of the `eventSourceInitDict` parameter to `new EventSource(url, eventSourceInitDict)` |

### Outputs

An asynchronous stream of objects, one per received server-sent event. Each object will have `type` and `data` fields. Otherwise, the content and format of the events are determined by the server:

    {
        type: "<...some string...>",
        data: "<...message body...>"
    }

The default value for the `type` field defined by the WHATWG specification is `"message"` but can be set to (almost) any string for a given message sent by a given server. The value of the `data` field may be anything that can be encoded in a HTTP response message.

### Details

This is a deliberately minimalist implementation of the protocol and JavaScript interface underlying the standard <i>EventSource</i> feature available in modern web browsers. It can be used, for example, to interface with the SSE based features of the [Philips Hue Bridge API V2](https://developers.meethue.com/develop/hue-api-v2/core-concepts/#events), as demonstrated by the example flows included in this node's package. Each event object sent by a Hue Bridge will be of `type` "message" and will have `data` formatted as a JSON string. See <https://developers.meethue.com/develop/hue-api-v2/core-concepts/#events> for details.

An aspect of this "minimalist" philoosophy is that an instance of `EventSource` wrapped by this node will automatically subscribe to and forward to the node's output **all** messages sent by the server, using an `EventSource.onmessage` handler. It makes no attempt to expose the more fine grained `EventTarget.addEventListener(type, handler)` interface. To start receiving events, send a message with URL and configuration parameters in its payload as described above. The `EventSource` node will open a connection and begin sending event messages asynchronously as they are sent by the server. The `status.text` of the `EventSource` node can be used to track the state of the connection:

| `status.text` | Description                                                                                     |
|---------------|-------------------------------------------------------------------------------------------------|
| `-1`          | The `eventsource` client object has not yet been created                                        |
|  `0`          | The `eventsource.readyState` value indicating the client is attempting to connect to the server |
|  `1`          | The `eventsource.readyState` value indicating the client is currently connected to the server   |
|  `2`          | The `eventsource.readyState` value indicating the connection has failed                         |

### Example Flows

This package include three example flows:

1. _hue-bridge-sse.json_
2. _hue-bridge-sse-with-reconnect.json_
3. _complete-example-for-philips-hue.json_

The example flows are of increasing complexity, in the order listed above. All three will require modification to work in your environment. In particular, the payloads of the `change` nodes named _set eventsource parameters_ in the first two examples will have to be changed to use your bridge's IP address and your client access key. Similarly, the `ADDRESS` and `KEY` environment variables defined by the _Chez Nous Main_ flow in the _complete-example-for-philips-hue.json_ example will need to be changed to reflect your setup.

#### (Not So) Complete Example

The _complete-example-for-philips-hue.json_ example is directly exported from one tab of my actual home automation server. It defines a set of flows and subflows which, colletively, allow receiving server-sent events and sending rate-limited requests to the [Philips Hue Bridge API V2](https://developers.meethue.com/develop/hue-api-v2/) on a Hue bridge. The subflows are organized and parameterized using environment variables to make it relatively simple to support multiple bridges on a single LAN (I use two in "production" and sometimes a third for testing, each of which is represented by a tab just like this example with different values for the `ADDRESS`, `KEY` and `TOPIC` environment variables). Despite the name, this "complete" example does not actually do anything with the SSE messages it receives. In the example, there is a `link out` node named _send to broker_ that is not connected to anything. In my actual home automation system, that links to a separate flow that sends rate-limited, retained messages to a MQTT broker. Other flows act on those MQTT messages to update the state of dashboard controls, trigger automation etc.
