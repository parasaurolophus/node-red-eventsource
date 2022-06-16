# @parasaurolophus/node-red-eventsource

Wrap the [eventsource](https://github.com/EventSource/eventsource) package as a node.

See:

- <https://github.com/EventSource/eventsource>
- <https://html.spec.whatwg.org/multipage/server-sent-events.html#server-sent-events>

### Inputs

If `msg.payload` is an object with a `url` property and, optionally, an `initDict` property then this node uses `new EventSource(msg.payload.url, msg.payload.initDict)` to wrap a newly created `eventsource` instance. The `initDict` defaults to an empty object (`{}`) if it is not supplied in `msg.payload`.

| Property               | Description                                                                                                                       |
|------------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| `msg.payload.url`      | (Required) URL of the SSE server                                                                                                  |
| `msg.payload.initDict` | (Optional) JavaScript object representation of the `eventSourceInitDict` parameter to `new EventSource(url, eventSourceInitDict)` |

Otherwise, if `msg.payload` is not an object or does not have a `url` property then this node calls the `eventsource.close()` method of the wrapped instance, if it exists.

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

The default value for the `type` field defined by the [WHATWG](https://html.spec.whatwg.org/multipage/server-sent-events.html#server-sent-events) specification is `"message"` but can be set to (almost) any string for a given event sent by a given server. The value of the `data` field may be anything that can be encoded in a HTTP response message.

#### Output 2: onopen

The second output will emit the objects sent to the `EventSource.onopen` handler. Each such object will have `msg.topic` set to `"open"` and `msg.payload` will be the value passed to the handler.

#### Output 3: onerror

The third output will emit the objects sent to the `EventSource.onerror` handler. Each such object will have `msg.topic` set to `"error"` and `msg.payload` will be the value passed to the handler. See <https://github.com/EventSource/eventsource#http-status-code-on-error-events> for information on the payload content.

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

```mermaid
stateDiagram-v2

    connecting: connecting\n(readyState 0)
    connected: connected\n(readyState 1)
    closed: closed\n(readyState 2)

    [*] --> connecting: new EventSource(msg.payload.url, msg.payload.initDict)\n(input with valid msg.payload)
    connecting --> connected: eventsource.onopen\n(output 2)
    note right of connected: server-sent events\nare forwarded while\nconnected (output 1)
    connected --> connecting: eventsource.onerror\n(output 3)
    connecting --> closed: eventsource.close()\n(input with invalid msg.payload)
    connected --> closed: eventsource.close()\n(input with invalid msg.payload)
    closed --> [*]
```

> _Note that you must use a `status` node to track the 'eventsource.readyState' values described above rather than relying on the life-cycle messages in order to capture the current state of the connection. Due to deficiencies in the SSE specification and limitations in the `eventsource` package implementation, the life-cycle messages are useful mainly to provide diagnostics for particular, known network connection issues. Even the node status, which reflects the value of the `eventsource.readyState` property on an ongoing basis, is not 100% reliable as an indicator that the connection to the SSE server is healthy. For really critical application, it may be wise to include an additional watchdog timer on output 1. Such a watchdog timer would send a new message with valid connection parameters to the `EventSource` node's input if an unexpectedly long time elapses with no server-sent event messages being received. Since what counts as "an unexpectedly long time" is application-specific, it is left as an exercise for the reader to add such checks rather than trying to build one-size-fits all error recovery logic into this node to supplement that which already provided by the wrapped `eventsource` library. Similarly, it might be possible to detect and diagnose infrastructure issues by use of the contents of the error life-cycle events emitted from output 3. Again, since the details of what such messages might contain and how to interpret them is somewhat dependent on a particular deployment, no attempt is made to bake-in any particular error detection or recovery logic._

### Example Flows

There are three example flows provided in this package, of increasing complexity and completenes:

1. _basic-eventsource-example.json_ consists of nothing but a single `EventSource` node with directly connected `inject` and `debug` nodes to let you experiment manually

2. _eventsource-with-automatic-reconnection.json_ builds on the first example by providing logic to detect when `eventsource.readyState` is 2 (`CLOSED`) and attempts automatically to reconnect

3. _hue-sse.json_ wraps the first example in a subflow and adds a second subflow that parses the specific server-side event format emitted by a [Philips Hue Bridge](https://developers.meethue.com/develop/hue-api-v2/core-concepts/#events)