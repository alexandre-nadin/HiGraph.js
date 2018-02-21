// Valutare dimensione dei numeri : https://github.com/neo4j/neo4j-javascript-driver#a-note-on-numbers-and-the-integer-type
// Leggere la sezione "A note on numbers and the Integer type" in fondo al readme.md
// Verificare se (2^53- 1) e' sufficiente per contenere gli indici dei nucleotidi nei cromosomi

const INPUT_REGEX = /^(X|Y|x|y|[0-9]|1[0-9]|2[0-2]):\d+-\d+$/;
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

let linkSelection = SVG_SELECTION.append("g").selectAll(".link");
let nodeSelection = SVG_SELECTION.append("g").selectAll(".node");

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
  linkSelection.attr("transform", d3.event.transform);
  nodeSelection.attr("transform", d3.event.transform);
  linkSelection.attr("stroke-width", 2/d3.event.transform.k);
  nodeSelection.attr("r", 8/d3.event.transform.k)
               .attr("stroke-width", 1/d3.event.transform.k);
  currentTransform = d3.event.transform;
}



// GO
function go() {
  d3.selectAll("input,button").attr("disabled", true);

  let parameters = getCoordinates();

  if(!parameters) {
    window.alert("Wrong coordinates");
    d3.selectAll("input,button").attr("disabled", null);
    return;
  }
  SVG_SELECTION.call(ZOOM.transform, d3.zoomIdentity);
  GRAPH_VIEW.resetLevel();

  let level = GRAPH_VIEW.level;
  parameters.level = level;

  getData(parameters);
}

// REFRESH
function refresh() {
  d3.selectAll("input,button").attr("disabled", true);
  if(GRAPH_VIEW.root == null) {
    d3.selectAll("input,button").attr("disabled", null);
    return;
  }


  let chromosome = graphView.root.chromosome;
  let start      = graphView.root.start;
  let end        = graphView.root.end;
  let level      = graphView.level;
  let parameters = {chromosome: chromosome, start: start, end: end, level: level};

  getData(parameters);
}

// ZOOM IN
function decreaseLevel() {
  d3.selectAll("input,button").attr("disabled", true);
  if ( GRAPH_VIEW.level == 0 || GRAPH_VIEW.root == null) {
    d3.selectAll("input,button").attr("disabled", null);
    return;
  }

  let chromosome = graphView.root.chromosome;
  let start      = graphView.root.start;
  let end        = graphView.root.end;
  let level      = graphView.level;
  let parameters = {chromosome: chromosome, start: start, end: end, level: level};

  getData(parameters);
}

// ZOOM OUT
function increaseLevel() {
  d3.selectAll("input,button").attr("disabled", true);
  if(GRAPH_VIEW.root == null) {
    d3.selectAll("input,button").attr("disabled", null);
    return;
  }

  let chromosome = graphView.root.chromosome;
  let start      = graphView.root.start;
  let end        = graphView.root.end;
  let level      = graphView.level;
  let parameters = {chromosome: chromosome, start: start, end: end, level: level};

  getData(parameters);
}

// GET PARAMETERS
function getCoordinates() {
  let input  = d3.select("#coordinates").property("value");
  if(!inputRegex.test(input)) return null;
  let coordinates = input.split(/:|-/);
  let chromosome = coordinates[0];
  let start = +coordinates[1];
  let end = +coordinates[2];
  if(start > end) return null;
  return {chromosome: chromosome, start: start, end: end};
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
const FILE_NODES = "../data/nodes.csv";
const FILE_LINKS = "../data/links.csv";

getData(getDefaultParameters())
function getDefaultParameters() {
  // For tests
  return {
      chromosome: "10",
      end: 101480000,
      level: 1,
      start: 101470000
    };
}

function loadCsvDataNodesLinks(fileNodes, fileLinks, parameters=null) {
  d3.queue()
    .defer(d3.csv, fileNodes)
    .defer(d3.csv, fileLinks)
    .await(processCsvNodesLinks(parameters));
}

function processCsvNodesLinks(parameters) {
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

// RENDER GRAPH
function renderGraph(parameters) {
  // Reset the nodes
  SVG_SELECTION.selectAll("circle").remove()
  SVG_SELECTION.selectAll(".node").remove()
  nodeSelection = SVG_SELECTION.selectAll(".node");

  // Reset the links
  SVG_SELECTION.selectAll("line").remove()
  SVG_SELECTION.selectAll(".link").remove()
  linkSelection = SVG_SELECTION.selectAll(".link");

  GRAPH_VIEW.updateRoot(parameters.chromosome, parameters.start, parameters.end);
  GRAPH_VIEW.setColors();
  GRAPH_VIEW.root.fx = WIDTH/2;
  GRAPH_VIEW.root.fy = HEIGHT/2;

  // Apply the general update pattern to the links.
  linkSelection = linkSelection.data(GRAPH_VIEW.links, d => d.id);
  linkSelection.exit().remove();
  linkSelection = linkSelection.enter()
    .append("line")
    .attr("stroke", d => d.color)
    .attr("stroke-dasharray", d => d.type == "H" ? "2,2" : null)
    //.attr("stroke-width", d => Math.log10(d.weight))
    .attr("stroke-width", 2)
    .attr("transform", currentTransform)
    .attr("stroke-width", 2/currentTransform.k)
    .merge(linkSelection);

  // Apply the general update pattern to the nodes.
  nodeSelection = nodeSelection.data(GRAPH_VIEW.nodes, d => d.id);
  nodeSelection.exit().remove();
  nodeSelection = nodeSelection.enter()
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
    .merge(nodeSelection);

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
  getData({ chromosome: node.chromosome,
            start: node.start,
            end: node.end,
            level: node.level
          })
}

// TICK ACTIONS
function tickActions() {
  linkSelection
    .attr("x1", d => d.source.x)
    .attr("y1", d => d.source.y)
    .attr("x2", d => d.target.x)
    .attr("y2", d => d.target.y);

  nodeSelection
    .attr("cx", d => d.x)
    .attr("cy", d => d.y);
}
