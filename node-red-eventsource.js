module.exports = function (RED) {

    const EventSource = require('eventsource')
    const readyStateFill = ['yellow', 'green', 'red']

    function eventsource(config) {

        RED.nodes.createNode(this, config)
        var node = this

        function status() {

            if (node.es) {

                const fill = Math.min(readyStateFill.length - 1, Math.max(0, node.es.readyState))

                node.status({
                    text: node.es.readyState,
                    shape: 'dot',
                    fill: readyStateFill[fill]
                })

            } else {

                node.status({
                    text: -1,
                    shape: 'ring',
                    fill: 'gray'
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

        function connect(msg) {

            close()
            node.url = msg.payload.url

            if (node.url === undefined) {
                throw 'msg.payload.url not defined'
            }

            node.initDict = msg.payload.initDict || {}
            node.es = new EventSource(node.url, node.initDict)

            node.es.onopen = (event) => {
                status()
            }

            node.es.onerror = (err) => {
                status()
            }

            node.es.onmessage = (event) => {
                status()
                node.send({
                    payload: event
                })
            }
        }

        node.es = null
        node.initDict = {}

        node.on('close', close)

        node.on('input', function (msg) {

            connect(msg)

        })
    }

    RED.nodes.registerType("EventSource", eventsource)

}
