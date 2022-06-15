module.exports = function (RED) {

    const EventSource = require('eventsource')
    const statusFill = ['gray', 'yellow', 'green', 'red']

    function eventsource(config) {

        RED.nodes.createNode(this, config)
        var node = this

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

        function init() {

            node.es = null
            node.initDict = {}
            node.lastStatus = -2
            node.onclosed = null

        }

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

        function connect(msg) {

            close(false, null)

            if ((typeof msg.payload) == 'object' && msg.payload.url !== undefined) {

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
        }

        init()
        setInterval(status, 1000)

        node.on('close', close)

        node.on('input', function (msg) {

            connect(msg)

        })
    }

    RED.nodes.registerType("EventSource", eventsource)

}
