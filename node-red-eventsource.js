// Copyright 2023 Kirk Rader

// See accompanying LICENSE file for open source usage permissions

/**
 * Wrap [eventsource](https://github.com/EventSource/eventsource) as a
 * [Node-RED](https://nodered.org/) node
 * 
 * @param {*} RED Node-RED runtime API
 */
module.exports = function (RED) {

    var EventSource = require('eventsource')

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

        var node

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

            const lastStatus = node.lastStatus ?? -2
            const currentStatus = node.es?.readyState ?? -1

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
         * @param {*} url SSE server URL
         * 
         * @param {*} initDict `eventSourceInitDict` value
         */
        function connect(url, initDict) {

            node.url = url
            node.initDict = initDict || {}
            node.es = new EventSource(node.url, node.initDict)

            node.es.onopen = (evt) => {

                node.send([
                    null,
                    { payload: evt, topic: 'open' },
                    null,
                ])
                status()
            }

            node.es.onerror = (err) => {

                node.send([
                    null,
                    null,
                    { payload: err, topic: 'error' },
                ])
                status()
            }

            node.es.onmessage = (event) => {

                node.send([
                    { payload: event, topic: 'message' },
                    null,
                    null,
                ])
                status()
            }
        }

        /**
         * Node-RED life-cycle method called when the flow is being stopped or
         * the node disabled.
         * 
         * @param {*} done Callback to inform the runtime asynchronously that
         *                 the node is closed
         */
        function close(_, done) {

            if (node.es) {

                node.onclosed = done
                node.es.close()

            } else if (done) {

                done()
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

            node.url = msg.payload.url || node.url
            node.initDict = msg.payload.initDict || node.initDict

            // attempt to open a new connection if msg.payload is an object
            // with a url property
            if ((typeof msg.payload) == 'object' && msg.payload.url !== undefined) {

                connect(msg.payload.url, msg.payload.initDict || {})
            }
        }

        RED.nodes.createNode(this, config)
        node = this

        return new Promise((resolve, _) => {

            RED.util.evaluateNodeProperty(config.initDict, config.initDictType, node, null, (err, value) => {

                try {

                    if (err) {

                        throw err
                    }

                    node.initDict = value
                    node.url = RED.util.evaluateNodeProperty(config.url, config.urlType, node)
                    node.es = null
                    node.lastStatus = -2
                    node.onclosed = null
                    node.on('close', close)
                    node.on('input', function (msg) {

                        handleMessage(msg)
                    })

                    setInterval(status, 1000)

                    if (node.url) {

                        connect(node.url, node.initDict)
                    }

                } catch (e) {

                    RED.log.error(e)
                    node.status({ text: 'error parsing properties', shape: 'ring', fill: 'red' })
                }

                resolve(node)
            })
        })
    }

    RED.nodes.registerType("EventSource", eventsource)
}
