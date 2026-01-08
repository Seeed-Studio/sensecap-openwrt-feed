'use strict';
'require baseclass';
'require dom';
'require request';
'require rpc';
'require network';

var callValidatorState = rpc.declare({
	object: 'sensecap',
	method: 'lora_network_connect',
	reject: true
});

var callLoraHistory = rpc.declare({
    object: 'sensecap',
    method: 'lora_history',
    reject: true
});


var H = 300;  //lora packets chart height
var CHART_WIDTH = 800; // Intrinsic width for coordinate calculations
var vCnt = 10;  //num of grids on y-axis

return baseclass.extend({
    title: _('LoRa Status'),

	load: function() {
		return Promise.all([
			request.get(L.resource('svg/internet_connection.svg')).catch(function() { return null; }),
			request.get(L.resource('svg/lora_packets.svg')).catch(function() { return null; }),
			network.getNetworks(),
			callValidatorState().catch(function() { return { lora_pkt_fwd: 0, station: 0 }; }),
			callLoraHistory().catch(function() { return {}; })
		]);
	},

	render: function(data) {
		var svg1_res = data[0];
		var svg2_res = data[1];
		var allNetworks = data[2];
		var valResult = data[3];
		var historyResult = data[4];

		var rv = E('div');

		// --- Section 1: Internet Connection ---
		if (svg1_res && svg1_res.ok) {
			var svgDiv = E('div', { 'style': 'width:100%;' });
            svgDiv.innerHTML = svg1_res.text();
			
			// Update Internet Status
			var isOnline = false;
			if (Array.isArray(allNetworks)) {
				for (var i = 0; i < allNetworks.length; i++) {
					var net = allNetworks[i];
					if (net.getName() === 'loopback') continue;
					// Check for IPv4 or IPv6 gateway presence
					if (net.isUp() && (net.getGatewayAddr() || net.getGateway6Addr())) {
						isOnline = true;
						break;
					}
				}
			}

			var elCheckInternet = svgDiv.querySelector("#check_internet");
			var elErrorInternet = svgDiv.querySelector("#error_internet");
			if (elCheckInternet && elErrorInternet) {
				if (isOnline) {
					elCheckInternet.setAttribute('style', 'visibility: visible');
					elErrorInternet.setAttribute('style', 'visibility: hidden');
				} else {
					elCheckInternet.setAttribute('style', 'visibility: hidden');
					elErrorInternet.setAttribute('style', 'visibility: visible');
				}
			}

            // Update Validator Status
            var valState = valResult.lora_pkt_fwd | valResult.station;
            var elCheckValidator = svgDiv.querySelector("#check_validator");
            var elErrorValidator = svgDiv.querySelector("#error_validator");
            if (elCheckValidator && elErrorValidator) {
                if (valState == 1) {
                    elCheckValidator.setAttribute('style', 'visibility: visible');
                    elErrorValidator.setAttribute('style', 'visibility: hidden');
                } else {
                    elCheckValidator.setAttribute('style', 'visibility: hidden');
                    elErrorValidator.setAttribute('style', 'visibility: visible');
                }
            }

            rv.appendChild(E('div', { 'class': 'cbi-section' }, [
                E('h3', _('Internet Connection')),
                E('div', {}, [svgDiv])
            ]));
        }

        // --- Section 2: LoRa Packets ---
        // Create container
        var svg2Div = E('div', { 'style': 'width:100%; overflow:hidden;' });

        // Use loaded SVG if available, otherwise fallback to empty SVG
        if (svg2_res && svg2_res.ok) {
            svg2Div.innerHTML = svg2_res.text();
        } else {
            svg2Div.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1"></svg>';
        }

        var svgElement = svg2Div.querySelector('svg');
        if (svgElement) {
            svgElement.setAttribute('width', '100%');
            svgElement.setAttribute('height', '300px');
            // Set viewBox to match our calculation logic (0..800 width)
            svgElement.setAttribute('viewBox', `0 0 ${CHART_WIDTH} ${H}`);
            svgElement.setAttribute('preserveAspectRatio', 'none');

            this.initLoRaPacketsChart(svgElement, CHART_WIDTH);

            var chartData = [];
            if (L.isObject(historyResult) && 'data' in historyResult) {
                chartData = historyResult['data'];
            } else {
                for (let i = 0; i < 24; i++) chartData.push([0, 0]);
            }
            this.updateLoRaPacketsChart(svgElement, chartData, CHART_WIDTH);
        }

        rv.appendChild(E('div', { 'class': 'cbi-section' }, [
            E('h3', _('LoRa Packets')),
            E('div', { 'style': 'background:#fff; margin: 20px 0; border:1px solid #ddd;' }, [svg2Div])
        ]));

        return rv;
    },

    initLoRaPacketsChart: function (svg, width) {
        var G = svg.firstElementChild;
        if (!G || G.tagName !== 'g') {
            G = svg.querySelector('g');
        }
        if (!G) {
            G = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            svg.appendChild(G);
        }

        // Clear to prevent duplicates
        while (G.firstChild) {
            G.removeChild(G.firstChild);
        }

        var baselineH = H - 20;

        var elem = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        elem.setAttribute('x1', '4%');
        elem.setAttribute('y1', baselineH);
        elem.setAttribute('x2', '100%');
        elem.setAttribute('y2', baselineH);
        elem.setAttribute('style', 'stroke:black;stroke-width:1');
        G.appendChild(elem);

        for (let i = 0; i < 25; i++) {
            var x = 4 + i * 4;
            elem = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            elem.setAttribute('x1', `${x}%`);
            elem.setAttribute('y1', baselineH);
            elem.setAttribute('x2', `${x}%`);
            elem.setAttribute('y2', baselineH + 2);
            elem.setAttribute('style', 'stroke:black;stroke-width:1');
            G.appendChild(elem);

            var hour = -24 + i;
            var text = `${hour}h`;
            elem = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            elem.setAttribute('y', 295);
            elem.setAttribute('style', 'fill:#666; font-size:9pt; font-family:sans-serif;');
            elem.setAttribute('x', `${x - 1.5}%`);
            elem.appendChild(document.createTextNode(text));
            G.appendChild(elem);
        }

        //create legend
        var lgX = width - 150;
        var elem = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        elem.setAttribute('x', lgX);
        elem.setAttribute('y', 10);
        elem.setAttribute('width', 20); lgX += 22;
        elem.setAttribute('height', 8);
        elem.setAttribute('style', 'fill:green;fill-opacity:0.4;stroke:green;stroke-width:1');
        G.appendChild(elem);

        elem = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        elem.setAttribute('x', lgX); lgX += 20;
        elem.setAttribute('y', 18);
        elem.setAttribute('style', 'fill:green; font-size:9pt; font-family:sans-serif;');
        elem.appendChild(document.createTextNode('rx'));
        G.appendChild(elem);

        elem = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        elem.setAttribute('x', lgX);
        elem.setAttribute('y', 10);
        elem.setAttribute('width', 20); lgX += 22;
        elem.setAttribute('height', 8);
        elem.setAttribute('style', 'fill:blue;fill-opacity:0.4;stroke:blue;stroke-width:1');
        G.appendChild(elem);

        elem = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        elem.setAttribute('x', lgX); lgX += 20;
        elem.setAttribute('y', 18);
        elem.setAttribute('style', 'fill:blue; font-size:9pt; font-family:sans-serif;');
        elem.appendChild(document.createTextNode('tx'));
        G.appendChild(elem);

        elem = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        elem.setAttribute('x', lgX);
        elem.setAttribute('y', 18);
        elem.setAttribute('style', 'fill:red; font-size:9pt; font-family:sans-serif;');
        elem.appendChild(document.createTextNode('total'));
        G.appendChild(elem);

        // create y-axis grids
        var vStep = (H - 20 - 20) / vCnt;

        for (let i = 0; i < 10; i++) {
            var y = H - 20 - (i + 1) * vStep;
            let elem = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            elem.setAttribute('x1', '4%');
            elem.setAttribute('y1', y);
            elem.setAttribute('x2', '100%');
            elem.setAttribute('y2', y);
            elem.setAttribute('style', 'stroke:#eee;stroke-width:1');
            G.appendChild(elem);

            var text = `${i + 1}`;
            elem = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            elem.setAttribute('y', y + 3);
            elem.setAttribute('style', 'fill:#666; font-size:9pt; font-family:sans-serif;');
            elem.setAttribute('x', 5);
            elem.setAttribute('id', `ytext${i}`);
            elem.appendChild(document.createTextNode(text));
            G.appendChild(elem);
        }

        // Initialize chart lines empty 
        let center = 98;
        let yBase = H - 20;
        for (let i = 0; i < 24; i++) {
            const points = [
                (width * (center - 1) / 100) + ',' + (yBase),
                (width * (center - 1) / 100) + ',' + (yBase),
                (width * (center + 1) / 100) + ',' + (yBase),
                (width * (center + 1) / 100) + ',' + (yBase),
            ];

            let polyrx = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
            polyrx.setAttribute('style', 'fill:green;fill-opacity:0.4;stroke:green;stroke-width:0.5');
            polyrx.setAttribute('points', points);
            polyrx.setAttribute('id', `rx${i}`);
            G.appendChild(polyrx);

            let polytx = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
            polytx.setAttribute('style', 'fill:blue;fill-opacity:0.4;stroke:blue;stroke-width:0.5');
            polytx.setAttribute('points', points);
            polytx.setAttribute('id', `tx${i}`);
            G.appendChild(polytx);

            let textrx = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            textrx.setAttribute('style', 'fill:green; font-size:8pt; font-family:sans-serif');
            textrx.setAttribute('id', `rxtext${i}`);
            textrx.appendChild(document.createTextNode(""));
            G.appendChild(textrx);

            let texttx = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            texttx.setAttribute('style', 'fill:blue; font-size:8pt; font-family:sans-serif');
            texttx.setAttribute('id', `txtext${i}`);
            texttx.appendChild(document.createTextNode(""));
            G.appendChild(texttx);

            let texttotal = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            texttotal.setAttribute('style', 'fill:red; font-size:8pt; font-family:sans-serif');
            texttotal.setAttribute('id', `totaltext${i}`);
            texttotal.appendChild(document.createTextNode(""));
            G.appendChild(texttotal);

            center -= 4;
        }
    },

    updateLoRaPacketsChart: function (svg, data, width) {
        var G = svg.firstElementChild;
        if (!G || G.tagName !== 'g') G = svg.querySelector('g');
        if (!G) return;

        if (!(Array.isArray(data) && data.length == 24)) {
            return;
        }

        var maxCnt = 0;
        for (const [rx, tx] of data) {
            const cnt = parseInt(rx || 0) + parseInt(tx || 0);
            if (cnt > maxCnt) maxCnt = cnt;
        }

        maxCnt = maxCnt % 10 == 0 ? maxCnt : (maxCnt - (maxCnt % 10) + 10);
        if (maxCnt < 10) maxCnt = 10;

        var nStep = maxCnt / vCnt;

        for (let i = 0; i < vCnt; i++) {
            let elem = G.querySelector(`#ytext${i}`);
            if (elem) {
                var text = `${Math.round(nStep * (i + 1))}`;
                dom.content(elem, text);
            }
        }

        let center = 98;
        let yBase = H - 20;
        let yPer = (H - 20 - 20) / maxCnt;

        for (let i = 0; i < 24; i++) {
            let [rx, tx] = data[i];
            rx = parseInt(rx || 0);
            tx = parseInt(tx || 0);

            //rx
            const points = [
                (width * (center - 1) / 100) + ',' + (yBase),
                (width * (center - 1) / 100) + ',' + (yBase - yPer * rx),
                (width * (center + 1) / 100) + ',' + (yBase - yPer * rx),
                (width * (center + 1) / 100) + ',' + (yBase),
            ];
            let rxTop = (yBase - yPer * rx);
            let poly = G.querySelector(`#rx${i}`);
            let text = G.querySelector(`#rxtext${i}`);
            if (poly) poly.setAttribute('points', points);
            if (text) {
                text.setAttribute('y', rxTop + 9);
                text.setAttribute('x', (width * center / 100) - (`${rx}`.length * 6) / 2);
                if (yPer * rx > 9) {
                    dom.content(text, `${rx}`);
                } else {
                    dom.content(text, "");
                }
            }

            //tx
            const points2 = [
                (width * (center - 1) / 100) + ',' + (rxTop),
                (width * (center - 1) / 100) + ',' + (rxTop - yPer * tx),
                (width * (center + 1) / 100) + ',' + (rxTop - yPer * tx),
                (width * (center + 1) / 100) + ',' + (rxTop),
            ];
            let txTop = (rxTop - yPer * tx);
            let poly2 = G.querySelector(`#tx${i}`);
            let text2 = G.querySelector(`#txtext${i}`);
            if (poly2) poly2.setAttribute('points', points2);
            if (text2) {
                text2.setAttribute('y', txTop + 9);
                text2.setAttribute('x', (width * center / 100) - (`${tx}`.length * 6) / 2);
                if (yPer * tx > 9) {
                    dom.content(text2, `${tx}`);
                } else {
                    dom.content(text2, "");
                }
            }

            //total
            let total = rx + tx;
            let text3 = G.querySelector(`#totaltext${i}`);
            if (text3) {
                if (total > 0 && yPer * total > 9) {
                    text3.setAttribute('y', txTop - 2);
                    text3.setAttribute('x', (width * center / 100) - (`${total}`.length * 6) / 2);
                    dom.content(text3, `${total}`);
                } else {
                    dom.content(text3, "");
                }
            }

            center -= 4;
        }
    }
});
