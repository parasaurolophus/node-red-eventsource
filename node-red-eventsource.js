// Copyright 2022 Kirk Rader

// See accompanying LICENSE file for open source usage permissions

/**
 * Wrap [eventsource](https://github.com/EventSource/eventsource) as a
 * [Node-RED](https://nodered.org/) node
 * 
 * @param {*} RED Node-RED runtime API
 */
module.exports = function (RED) {

    var EventSource = require('eventsource')
    var Mutex = require('async-mutex').Mutex

    /**
     * Protect node state
     */
    const mutex = new Mutex()

    /**
     * Color names for `node.status({text: ... fill: ...})`
     * 
     * Note that the number and order of elements corresponds to the numeric
     * values used for the `text` property.
     */
    const statusFill = ['gray', 'yellow', 'green', 'red']

    /**
     * Node constructor
     * 
     * @param {*} config Node's runtime configuration
     */
    function eventsource(config) {

        RED.nodes.createNode(this, config)
        var node = this

        node.url = RED.util.evaluateNodeProperty(node.credentials.url, config.urlType, node)
        node.initDict = RED.util.evaluateNodeProperty(node.credentials.initDict, config.initDictType, node)
        node.es = null
        node.lastStatus = -2
        node.onclosed = null

        /**
         * Called periodically to emit the current `eventsource.readyState`
         * as the node's status
         * 
         * Status text is -1 if the wrapped `eventsource` does not exist.
         * Otherwise, it is the value of `eventsource.readyState`.
         * 
         * As a side-effect, fire node.onclosed callback when
         * `eventsource.readyState` reaches 2.
         */
        async function status() {

            const release = await mutex.acquire()

            try {

                const lastStatus = node.lastStatus || -2
                const currentStatus = node.es ? node.es.readyState : -1

                if (currentStatus != lastStatus) {

                    node.status({
                        text: currentStatus,
                        shape: 'dot',
                        fill: statusFill[currentStatus + 1]
                    })

                    node.lastStatus = currentStatus

                }

                if (currentStatus == 2 && node.onclosed) {

                    node.onclosed()
                    node.onclosed = null

                }

            } finally {

                release()

            }
        }

        /**
         * Create a new wrapped `eventsource` instance
         * 
         * @param {*} url SSE server URL
         * 
         * @param {*} initDit `eventSourceInitDict` value
         */
        async function connect(url, initDict) {

            const release = await mutex.acquire()

            try {

                node.url = url
                node.initDict = initDict || {}
                node.es = new EventSource(node.url, node.initDict)

                node.es.onopen = (evt) => {

                    node.send([null, { topic: 'open', payload: evt }, null])
                    status()

                }

                node.es.onerror = (err) => {

                    node.send([null, null, { topic: 'error', payload: err }])
                    status()

                }

                node.es.onmessage = (event) => {

                    node.send([{ topic: 'message', payload: event }, null, null])

                }

            } finally {

                release()

            }

            status()

        }

        /**
         * Node-RED life-cycle method called when the flow is being stopped or
         * the node disabled.
         * 
         * @param {*} _removed Ignored
         * @param {*} done Callback to inform the runtime asynchronously that
         *                 the node is closed
         */
        async function close(_removed, done) {

            const release = await mutex.acquire()

            try {

                if (node.es) {

                    node.onclosed = done
                    node.es.close()


                } else if (done) {

                    done()

                }

            } finally {

                release()

            }
        }

        /**
         * Handle a message sent to the node's input port
         * 
         * @param {*} msg The message to handle 
         */
        function handleMessage(msg) {

            // clean up current connection, if any
            close(false, null)

            // attempt to open a new connection if msg.payload is an object
            // with a url property
            if ((typeof msg.payload) == 'object' && msg.payload.url !== undefined) {

                connect(msg.payload.url, msg.payload.initDict || {})

            }
        }

        node.on('close', close)

        node.on('input', function (msg) {

            handleMessage(msg)

        })


        setInterval(status, 1000)

        if (node.url) {

            connect(node.url, node.initDict)

        }
    }

    RED.nodes.registerType(
        "EventSource",
        eventsource,
        {
            credentials: {
                url: { type: "text" },
                initDict: { type: "text" }
            }
        })

}
