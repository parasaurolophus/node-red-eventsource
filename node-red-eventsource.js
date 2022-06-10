module.exports = function(RED) {

    const EventSource = require('eventsource')

    function eventsource(config) {

        RED.nodes.createNode(this,config)
        var node = this

        function status() {

            if (node.es) {

                node.status({
                    text: node.es.readyState,
                    shape: 'dot',
                    fill: 'green'
                })

            } else {

                node.status({
                    text: 'disconnected',
                    shape: 'ring',
                    fill: 'yellow'
                })

            }

        }

        function close() {

            if (node.es) {

                node.es.close()
                node.es = null
                node.initDict = {}

            }

            status()

        }

        function open(msg) {

            close()
            node.url = msg.payload.url

            if (node.url === undefined) {
                throw 'msg.payload.url not defined'
            }

            node.initDict = msg.payload.initDict || {}
            node.es = new EventSource(node.url, node.initDict)

            node.es.onerror = (err) => {
                if (err) {
                    node.warn(err)
                }
            }

            node.es.onmessage = (event) => {
                node.send({
                    topic: event.event,
                    payload: event.data
                })
            }

            status()

        }

        node.es = null
        node.initDict = {}
        status()

        node.on('close', close)

        node.on('input', function(msg) {

            open(msg)
            //node.send(msg)

        })

    }

    RED.nodes.registerType("EventSource", eventsource)

}
