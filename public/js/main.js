// Valutare dimensione dei numeri : https://github.com/neo4j/neo4j-javascript-driver#a-note-on-numbers-and-the-integer-type
// Leggere la sezione "A note on numbers and the Integer type" in fondo al readme.md
// Verificare se (2^53- 1) e' sufficiente per contenere gli indici dei nucleotidi nei cromosomi

const INPUT_REGEX = /^(X|Y|x|y|[0-9]|1[0-9]|2[0-2]):\d+-\d+$/;
const INPUT_SPLIT = /:|-/;
const CONTAINER_SELECTION = d3.select("#hicviz-container")

const NAVIGATION_SELECTION = CONTAINER_SELECTION.append("div")
  .attr("id", "navigation");

NAVIGATION_SELECTION.append("input")
  .attr("id", "coordinates")
  .attr("type", "text")
  .attr("placeholder", "chr:start-end (example 10:103765000-103770000)");
NAVIGATION_SELECTION.append("button")
  .attr("id", "go-button")
  .html("Go")
  .on("click", go);
NAVIGATION_SELECTION.append("button")
  .attr("id", "zoom-out-button")
  .html("Zoom-Out")
  .on("click", increaseLevel);
NAVIGATION_SELECTION.append("button")
  .attr("id", "zoom-in-button")
  .html("Zoom-In")
  .on("click", decreaseLevel);
NAVIGATION_SELECTION.append("button")
  .attr("id", "refresh-button")
  .html("Refresh")
  .on("click", refresh);

const HEATMAP_SELECTION = CONTAINER_SELECTION.append("div")
  .attr("id", "heatmap");

const ZOOM = d3.zoom()
  .wheelDelta(myDelta)
  .on("zoom", zoomActions);

const SCALE = 0.85;
const WIDTH = +CONTAINER_SELECTION.attr("width");
const HEIGHT = +CONTAINER_SELECTION.attr("height") * SCALE;

const SVG_SELECTION = CONTAINER_SELECTION.append("svg")
  .attr("id", "graph-container")
  .attr("width", WIDTH)
  .attr("height", HEIGHT)
  .call(ZOOM);

let currentTransform = d3.zoomIdentity;

const TOOLTIP = CONTAINER_SELECTION.append("div")
  .attr("id", "tooltip")
  .style("opacity", 0);

const GRAPH_VIEW = new GraphView();

const FORCE_SIMULATION = d3.forceSimulation(GRAPH_VIEW.nodes)
  .force("charge", d3.forceManyBody())
  .force("link", d3.forceLink().id(d => d.id))
  .force("center", d3.forceCenter(WIDTH / 2, HEIGHT / 2))
  .on("tick", tickActions);

// MY DELTA
function myDelta() {
  return -d3.event.deltaY * (d3.event.deltaMode ? 120 : 1) / 6000;
}

// ZOOM ACTIONS
function zoomActions() {
  SVG_SELECTION.selectAll("line")
    .attr("transform", d3.event.transform)
    .attr("stroke-width", 2/d3.event.transform.k)

  SVG_SELECTION.selectAll("circle")
    .attr("transform", d3.event.transform)
    .attr("r", 8/d3.event.transform.k)
    .attr("stroke-width", 1/d3.event.transform.k)
  currentTransform = d3.event.transform;
}

// REFRESH
function refresh() {
  d3.selectAll("input,button").attr("disabled", true);
  if(GRAPH_VIEW.root == null) {
    d3.selectAll("input,button").attr("disabled", null);
    return;
  }
  SVG_SELECTION.call(ZOOM.transform, d3.zoomIdentity);
  getData(GRAPH_VIEW.getFormattedRoot())
}

// ZOOM IN
function decreaseLevel() {
  d3.selectAll("input,button").attr("disabled", true);
  if ( GRAPH_VIEW.level == 0 || GRAPH_VIEW.root == null) {
    d3.selectAll("input,button").attr("disabled", null);
    return;
  }
  GRAPH_VIEW.decreaseLevel();
  getData(GRAPH_VIEW.getFormattedRoot());
}

// ZOOM OUT
function increaseLevel() {
  d3.selectAll("input,button").attr("disabled", true);
  if(GRAPH_VIEW.root == null) {
    d3.selectAll("input,button").attr("disabled", null);
    return;
  }
  GRAPH_VIEW.increaseLevel();
  getData(GRAPH_VIEW.getFormattedRoot());
}

// # --------------------------------------
// # LOADING DATA FROM DIFFERENT SOURCES
// # csv or database
// # --------------------------------------
const DATA_MODES = {
  file: loadCsvDataNodesLinks,
  database: loadDatabaseData
};
var dataMode = 'file';

// d1 reading multiple files
const FILE_NODES = "../data/nodes.csv" + "_h10";
const FILE_LINKS = "../data/links.csv" + "_h10";

// For initializing test
getData((new Node(null, "10", 101470000, 101480000)))

// GO
function go() {
  d3.selectAll("input,button").attr("disabled", true);
  var inputNode = getInputNode();
  if(!inputNode) {
    window.alert("Wrong coordinates");
    d3.selectAll("input,button").attr("disabled", null);
    return;
  }
  SVG_SELECTION.call(ZOOM.transform, d3.zoomIdentity);
  GRAPH_VIEW.resetLevel();
  getData(GRAPH_VIEW.formatNode(inputNode));
}

// GET INPUT PARAMETERS
function getInputNode() {
  // Returns a formatted Node from the input coordinates.
  let input  = d3.select("#coordinates").property("value");
  if (!INPUT_REGEX.test(input)) return null
  let coordinates = input.split(INPUT_SPLIT);
  let chromosome = coordinates[0];
  let start = +coordinates[1];
  let end = +coordinates[2];
  if(start > end) return null;
  return new Node(null, chromosome, start, end)
}

// GET DATA
function getData(parameters) {
  FORCE_SIMULATION.stop();
  GRAPH_VIEW.clear();

  if(dataMode === "file") {
    console.log("Rendering from file");
    loadCsvDataNodesLinks(
      FILE_NODES,
      FILE_LINKS,
      parameters
    );
  } else if (dataMode === "database") {
    console.log("Rendering from database");
    loadDatabaseData(parameters)
  } else {
    console.log("No rendering mode found for '", dataMode, "'");
    return null;
  }
  d3.selectAll('input,button').attr('disabled', null);
}

function loadDatabaseData(parameters) {
  d3.request("http://localhost:3000/query")
    .header("Content-Type", "application/json")
    .mimeType("application/json")
    .response(xhr => JSON.parse(xhr.responseText))
    .post(JSON.stringify(parameters), (err, res) => {
        if(res == null) {
          window.alert("The region is not in the database");
        } else {
          updateGraph(res);
          renderGraph(parameters);
        }
    });
}

function loadCsvDataNodesLinks(fileNodes, fileLinks, parameters=null) {
  /*
   * Loads CSV files for nodes and links.
   * Send them to the process function.
   */
  d3.queue()
    .defer(d3.csv, fileNodes)
    .defer(d3.csv, fileLinks)
    .await(processCsvNodesLinks_links(parameters));
    // .await(processCsvNodesLinks_all(parameters));
}

function processCsvNodesLinks_all(parameters) {
  /*
   * Processes nodes and links separately
   * Implies both come from different files.
   */
  return function (error, nodes, links) {
    var linkId = 0
    if(error) { console.log(error); }
    updateGraph({
      nodes: nodes.map(x => formatCsvDataNode(x)),
      links: links.map(x => formatCsvDataLink(x, linkId++))
    })
    renderGraph(parameters)
  }
}

function processCsvNodesLinks_links(parameters) {
  /*
   * Processes links and nodes from links.
   * Implies only links files are provided.
   */
  return function (error, nodes, links) {
    if(error) { console.log(error); }
    updateGraph(getNodesLinksFromLinks(links))
    renderGraph(parameters)
  }
}

function getNodesLinksFromLinks(plinks) {
  /*
   * Parses raw links and extracts actual links and nodes from them.
   * Returns a dictionary of unique nodes and links.
   */
  var nodes = []
  var links = []
  var linkId = 0
  plinks.forEach(l => {
    pushUniqueObjectsByAttributes(
      links,
      [ formatCsvDataLink(l, linkId++)],
      GRAPH_VIEW.getLinkUniqueAttrs()
    )
    pushUniqueObjectsByAttributes(
      nodes,
      [ formatCsvDataNode(
          new Node(null, l.sourceChromosome, l.sourceStart, l.sourceEnd)),
        formatCsvDataNode(
          new Node(null, l.targetChromosome, l.targetStart, l.targetEnd))
      ],
      GRAPH_VIEW.getNodeUniqueAttrs()
    )
  })
  return {
    nodes: nodes,
    links: links
  }
}

function pushUniqueObjectsByAttributes(uniqueObjects, objects, attributes=[]) {
  /*
   * Pushes the given 'objects' only if their specified list of 'attributes'
   * are unique in the provided unique list 'uniqueObjects'.
   */

  objects.forEach(o => {
    // Initialize list if empty.
    if (uniqueObjects.length === 0) {
      uniqueObjects.push(o)
    }

    // Else push if unique set of attributes only.
    if (! existsObjectByAttributes(uniqueObjects, o, attributes)) {
      uniqueObjects.push(o)
    }
  })
}

function existsObjectByAttributes(objects, object, attributes=[], atLeast=null) {
  /*
   * Returns true if all of the given 'object'`s 'attributes' exist in a list
   * of 'objects'.
   * Can specify the minimum number of attribute match required.
   */
  atLeast = (atLeast === null || atLeast > attributes.length || atLeast < 0)
            ? attributes.length
            : atLeast

  return (objects.filter(o => {
            return (attributes.filter(a => {
                      return (o[a] === object[a]) ;} )
                   .length
                   >= atLeast)
  }).length > 0)
}

function formatCsvDataNode(d, id=null) {
  return {
    id: String(d.chromosome + d.start + d.end),
    chromosome: d.chromosome,
    start: d.start,
    end: d.end
  }
}

function formatCsvDataLink(d, id=null) {
  return {
    id: id,
    source: String(d.sourceChromosome + d.sourceStart + d.sourceEnd),
    target: String(d.targetChromosome + d.targetStart + d.targetEnd),
    type: d.type,
    value: d.value
  }
}



// UPDATE GRAPH
function updateGraph(data) {
  // Nodes
  if(data.nodes == null) return;
  data.nodes.forEach(
    node => GRAPH_VIEW.addNode(node.id, node.chromosome, node.start, node.end)
  );
  // Links
  if(data.links == null) return;
  data.links.forEach(
    x => GRAPH_VIEW.addLink(x.id, x.source, x.target, x.type, x.value)
  );
}

function resetTypeDataView(type, data) {
  SVG_SELECTION.selectAll(String(type)).remove()
  return SVG_SELECTION.selectAll(String(type))
    .data(data, d => d.id)
}

function resetNodesView() {
  // Resets the nodes
  resetTypeDataView("circle", GRAPH_VIEW.nodes)
    .enter()
    .append("circle")
    .attr("r", 8)
    .attr("stroke", "#212121")
    .attr("stroke-width", "1")
    .attr("fill", d => d.color)
    .attr("transform", currentTransform)
    .attr("r", 8/currentTransform.k)
    .attr("stroke-width", 1/currentTransform.k)
    .on("mouseover", nodeOverActions)
    .on("mouseout", nodeOutActions)
    .on("click", nodeClickActions)
    // .merge(nodeSelection);
  return
}

function resetLinksView() {
  resetTypeDataView("line", GRAPH_VIEW.links)
    .enter()
    .append("line")
    .attr("stroke", d => d.color)
    .attr("stroke-dasharray", d => d.type == "H" ? "2,2" : null)
    // .attr("stroke-width", d => Math.log10(d.weight))
    .attr("stroke-width", 2)
    .attr("transform", currentTransform)
    .attr("stroke-width", 2/currentTransform.k)
    // .merge(linkSelection);
  return
}

// RENDER GRAPH
function renderGraph(parameters) {
  GRAPH_VIEW.updateRoot(parameters.chromosome, parameters.start, parameters.end);
  GRAPH_VIEW.setColors();
  GRAPH_VIEW.root.fx = WIDTH/2;
  GRAPH_VIEW.root.fy = HEIGHT/2;

  resetLinksView()
  resetNodesView()

  // Update and restart the simulation.
  FORCE_SIMULATION.force("link").links(GRAPH_VIEW.links);
  FORCE_SIMULATION.nodes(GRAPH_VIEW.nodes);
  FORCE_SIMULATION.alpha(1).restart();
}

// NODE OVER ACTIONS
function nodeOverActions(node) {
  TOOLTIP.transition()
    .duration(200)
    .style("opacity", .9);

  TOOLTIP.html("chr" + node.chromosome + "-" + node.start + "-" + node.end)
    .style("left", (d3.event.pageX) + "px")
    .style("top", (d3.event.pageY - 28) + "px");
}

// NODE OUT ACTIONS
function nodeOutActions(node) {
  TOOLTIP.transition()
    .duration(200)
    .style("opacity", 0);
}

// NODE CLICK ACTIONS
function nodeClickActions(node) {
  getData(GRAPH_VIEW.formatNode(node))
}

// TICK ACTIONS
function tickActions() {
  // linkSelection
  SVG_SELECTION.selectAll("line")
    .attr("x1", d => d.source.x)
    .attr("y1", d => d.source.y)
    .attr("x2", d => d.target.x)
    .attr("y2", d => d.target.y);

  // nodeSelection
  SVG_SELECTION.selectAll("circle")
    .attr("cx", d => d.x)
    .attr("cy", d => d.y);
}
