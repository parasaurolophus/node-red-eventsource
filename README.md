# @parasaurolophus/node-red-eventsource

Wrap the [eventsource](https://github.com/EventSource/eventsource) package as a node.

Used by a personal home automation flow: <https://github.com/parasaurolophus/automation>

See:

- <https://github.com/EventSource/eventsource>
- <https://html.spec.whatwg.org/multipage/server-sent-events.html#server-sent-events>
- <https://github.com/parasaurolophus/automation>

### Properties

_See the discussion of the `msg.payload.url` and `msg.payload.initDict` input message properties, below, for a full discussion of the `url` and `initDict` properties in the node settings dialog. While setting these parameters in the node itself is supported, for most real world scenarios it is better to leave these empty and rely on passing messages into an `EventSource` node to control its state. See the discussion, below, of the_ eventsource-with-automatic-reconnect.json _example for more information._

_Note also that the `url` and `initDict` properties are stored as encrypted credentials since they often contain sensitive information such as precise entity id's, access tokens and the like. This means that once set, they will be saved and restored when the flow is restarted but they will not be included when flows and subflows are exported. You can safely store flows that contain such configured nodes in a public version control repository, share flow snippets in wikis and so on._

If a URL is set in the node settings dialog, the node will attempt to connect automatically each time the flow is (re-)started. Such a node will still respond to messages sent to its input port as described in the next section.

### Inputs

_Any parameters passed in an incoming message will override the corresponding parameters specified via the node's settings dialog._

If `msg.payload` is an object with a `url` property and, optionally, an `initDict` property then this node uses `new EventSource(msg.payload.url, msg.payload.initDict)` to wrap a newly created `eventsource` instance. The `initDict` defaults to an empty object (`{}`) if it is not supplied in `msg.payload`.

| Property               | Description                                                                                                                       |
|------------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| `msg.payload.url`      | (Required) URL of the SSE server                                                                                                  |
| `msg.payload.initDict` | (Optional) JavaScript object representation of the `eventSourceInitDict` parameter to `new EventSource(url, eventSourceInitDict)` |

Otherwise, if `msg.payload` is not an object or does not have a `url` property then this node calls the `eventsource.close()` method of the wrapped instance, if it exists. If a subsequent message is received, any current connection will be closed before attempting to establish a new connection.

### Outputs

1. Asynchronous stream of server-sent event objects
2. Asynchronous stream of `EventSource.onopen` life-cycle messages
3. Asynchronous stream of `EventSource.onerror` life-cycle messages

#### Output 1: Server-Sent Events

Each server-sent event object emitted from the first output will have `msg.payload.type` and `msg.payload.data` fields and `msg.topic` set to `"message"`. The content and format of the `type` and `data` properties are determined by the server:

    {
        topic: "message",
        payload: {
            type: "<...some string...>",
            data: "<...message body...>"
        }
    }

The default value for the `type` field defined by the [WHATWG](https://html.spec.whatwg.org/multipage/server-sent-events.html#server-sent-events) specification is `"message"` but can be set to (almost) any string for a given event sent by a given server. The value of the `data` field may be anything that can be encoded in a HTTP response message but is often the HTML, JSON or XML encoded representation of some "entity."

#### Output 2: onopen

The second output will emit the objects sent to the `EventSource.onopen` handler. Each such object will have `msg.topic` set to `"open"` and `msg.payload` will be the value passed to the handler. The content of these `msg.payload` objects is less interesting for most purposes than the fact that the connection was successfully (re-)established.

#### Output 3: onerror

The third output will emit the objects sent to the `EventSource.onerror` handler. Each such object will have `msg.topic` set to `"error"` and `msg.payload` will be the value passed to the handler. See <https://github.com/EventSource/eventsource#http-status-code-on-error-events> for information on the payload content. As with `EventSource.onopen` events, the exact `msg.payload` here is usually of limited usefulness due to issues with the design and implementation of both the _WHATWG_ specification and the underlying _EventSource_ library package wrapped by this node. What is of interest, again, is that receipt of any event of this type indicates that the connection is experiencing (hopefully transient) issues and the underlying library package is still attempting to automatically (re-)connect.

### Details

This is a deliberately minimalist implementation of the protocol and JavaScript interface underlying the standard _EventSource_ feature available in modern web browsers. An aspect of the "minimalist" philoosophy is that an instance of `EventSource` wrapped by this node will automatically subscribe to and forward to the node's output **all** messages sent by the server, using an `EventSource.onmessage` handler. (In particular, it makes no attempt to expose the more fine grained `EventTarget.addEventListener(type, handler, ...)` interface.) To start receiving events, send a message with URL and configuration parameters in its payload as described above. The `EventSource` node will open a connection and begin emitting event messages asynchronously as they are sent by the server.

The `status.text` of the `EventSource` node can be used to track the state of the connection:

| `status.text` | Description                                                                                     |
|---------------|-------------------------------------------------------------------------------------------------|
| `-1`          | The `eventsource` client object has not yet been created since the flow was last (re-)started   |
|  `0`          | The `eventsource.readyState` value indicating the client is attempting to connect to the server |
|  `1`          | The `eventsource.readyState` value indicating the client is currently connected to the server   |
|  `2`          | The `eventsource.readyState` value indicating the connection has failed                         |

The `EventSource` node's status will oscillate between 0 and 1 as the wrapped `eventsource` instance attempts to stay connected. The `onopen` and `onerror` life-cycle messages described above are emitted along the way. If the status reaches 2, there will be no more attempts to reconnect automatically. You will need to send another `msg` to the `EventSource` node's input in order to resume receiving server-sent events.

> _Note that you must use a `status` node to track the 'eventsource.readyState' values described above rather than relying on the life-cycle messages in order to capture the current state of the connection. Due to deficiencies in the SSE specification and limitations in the `eventsource` package implementation, the life-cycle messages are useful mainly to provide diagnostics for particular, known network connection issues. Even the node status, which reflects the value of the `eventsource.readyState` property on an ongoing basis, is not 100% reliable as an indicator that the connection to the SSE server is healthy. For critical applications, it may be wise to include an additional watchdog timer on output 1. Such a watchdog timer would send a new message with valid connection parameters to the `EventSource` node's input if an unexpectedly long time elapses with no server-sent event messages being received. See the description, below, of the_ eventsource-with-automatic-reconnection.json _example flow for more information._

### Example Flows

There are three example flows provided in this package, of increasing complexity and completeness. You can watch the editor debug console panes while each is connected to a SSE server to see the `EventSource` node's status change to reflect the underlying `readyState` as well as the server-sent and life-cycle events it emits from its various outputs.

#### _basic-eventsource-example.json_

A single `EventSource` node with `debug` nodes connected to each of its outputs and a single `inject` node to let you experiment with manually closing a connection. You will have to configure the `url` and `initDict` values in the `EventSource` node's settings dialog. Once configured, the `EventSource` node will attempt to connect to your SSE server each time the flow is started and attempt to stay connected until the `inject` node named "close" is activated.

#### _dynamic-eventsource-example.json_

A single `EventSource` node with `debug` nodes connected to each of its outputs and two `inject` nodes to let you experiment with manually opening and closing a connection. You will have to configure the `url` and `initDict` values in the `inject` node named "open." Once configured, the `EventSource` node will attempt to connect to your SSE server each time the `inject` node named "open" is activated and attempt to stay connected until the `inject` node named "close" is activated.

#### _eventsource-with-automatic-reconnection.json_

This example wraps an `EventSource` node in a subflow and adds a additional subflows that subscribe to and parse the specific server-side event format emitted by a [Philips Hue Bridge](https://developers.meethue.com/develop/hue-api-v2/core-concepts/#events). If you have such a device, edit the `ADDRESS`, `KEY` and `TOPIC` as documented in the flow groups. You can then watch the debug pane as you turn on and off lights, your sensors report motion, temperature, light-level etc. Note that this example includes logic to parse the bridge's rather tortured payload into streams of somewhat more meaningful messages, one per resource whose state is being reported. (Even then, a fair amount of work needs to be done on the client side to correlate the payloads of various server-sent events and direct API queries to provide a meaningful interface to the state of a given bridge's configured devices and groups, but I digress....)

The point of this example is not to show how to make use of the Hue Bridge API but, rather, how to implement logic in a Node-RED flow to use a watchdog timer to manage the connection to a SSE server. In particular, the _Server-Sent Events_ subflow defined by this example wraps an `EventSource` node with retry logic based on a watchdog timer. The watchdog timer is started when the wrapped `EventSource` emits an `onopen` event. The timeout period is extended each time a server-sent event is emitted. If the watchdog times out, the original message that opened the connection is sent again to the input of the wrapped `EventSource` node to reestablish the connection. In addition, the `EventSource` status and `onerror` events are monitored to reset and restart the watchdog timer, as appropriate. Use the `TIMEOUT` environment variable to configure the duration of the watchdog timer.

> _Note: for "enterprise" scale applications, more sophisticated retry logic with a shorter initial timeout and increasing delays between connection attempts would be required. The given example works well enough for a home automation system consisting of Node-RED, a MQTT broker and a couple of Hue bridges. See <https://github.com/parasaurolophus/cheznous> for the complete home automation flow from this example was extracted. That shows how to use the rest (pun intended) of the Hue API for full round-trip integration with Hue devices using HTTP requests and server-side events. It also shows how multiple instances of these subflows and ones like it can be used to access multiple Hue bridges concurrently._
