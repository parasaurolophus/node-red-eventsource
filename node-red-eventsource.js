// Copyright 2022 Kirk Rader

// See accompanying LICENSE file for open source usage permissions

/**
 * Wrap [eventsource](https://github.com/EventSource/eventsource) as a
 * [Node-RED](https://nodered.org/) node
 * 
 * @param {*} RED Node-RED runtime API
 */
module.exports = function (RED) {

    const EventSource = require('eventsource')

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
        function status() {

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
        }

        /**
         * Create a new wrapped `eventsource` instance
         * 
         * @param {*} msg Message containing connection parameters 
         */
         function connect(msg) {

            node.url = msg.payload.url
            node.initDict = msg.payload.initDict || {}
            node.es = new EventSource(node.url, node.initDict)
            status()

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
        }

        /**
         * Node-RED life-cycle method called when the flow is being stopped or
         * the node disabled.
         * 
         * @param {*} _removed Ignored
         * @param {*} done Callback to inform the runtime asynchronously that
         *                 the node is closed
         */
        function close(_removed, done) {

            try {

                if (node.es) {

                    node.es.close()
                    node.onclosed = done

                }

            } finally {

                if (done) {

                    done()

                }
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

                connect(msg)

            }
        }

        // initialize node to handle incoming messages
        node.es = null
        node.initDict = {}
        node.lastStatus = -2
        node.onclosed = null
        setInterval(status, 1000)

        node.on('close', close)

        node.on('input', function (msg) {

            handleMessage(msg)

        })
    }

    RED.nodes.registerType("EventSource", eventsource)

}
