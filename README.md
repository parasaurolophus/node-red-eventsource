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

An asynchronous stream of objects, one per received server-sent event.

The content and format of the events are determined by the server. The Philips Hue Bridge API, for example, sends JSON formatted event data, each of which can contain state change information regarding multiple "resources" (lights, groups, sensors etc.).

### Details

This is a deliberately minimalist implementation of the protocol and JavaScript interface underlying the standard <i>EventSource</i> feature available in modern web browsers. It can be used, for example, to interface with the SSE based features of the [Philips Hue Bridge API V2](https://developers.meethue.com/develop/hue-api-v2/core-concepts/#events), as demonstrated by the example flows included in this node's package.

N.B. an aspect of this "minimalist" philoosophy is that an instance of `EventSource` wrapped by this node will automatically subscribe to and forward to the node's output **all** messages sent by the server, using an `EventSource.onmessage` handler. It makes no attempt to expose the more fine grained `EventTarget.addEventListener()` interface. To start receiving events, send a message with URL and configuration parameters in its payload as described above. The `EventSource` node will open a connection and begin sending event messages asynchronously as they are sent by the server. The `status.text` of the `EventSource` node can be used to track the state of the connection:

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

The _complete-example-for-philips-hue.json_ example is direct export of one tab from my "live" home automation server. It creates a set of flows and subflows which, colletively, allow sending rate-limited requests to the [Philips Hue Bridge API V2](https://developers.meethue.com/develop/hue-api-v2/) on one or more Hue bridges on your LAN. Despite the name, the "complete" example does not actually do anything with the SSE messages it receives. In the example, there is a `link out` node named _send to broker_ that is not connected to anything. In my actual home automation system, that links to a separate flow that sends rate-limited messages to a MQTT broker. Other flows act on those MQTT messages to update the state of dashboard controls, trigger automation etc.
