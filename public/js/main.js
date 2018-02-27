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

 // --------------------------------------
 // LOADING DATA FROM DIFFERENT SOURCES
 //   csv or database
 // --------------------------------------
const LOADING_DATA_MODES = {
  database: loadDataDatabase,
  csvLinks: loadDataCsvLinksNodes,
  csvLinksNodes: loadDataCsvLinksNodes
}
let loadingDataMode = 'csvLinks'

// Reading multiple files
// const CSV_NODES = "../data/nodes.csv" + "_h10";
// const CSV_LINKS = "../data/links.csv" + "_h10";
const CSV_LINKS = "../data/links_neighbors.csv";

const NEIGHBOR_LEVEL_DEFAULT = 2
let neighborLevelCurrent = NEIGHBOR_LEVEL_DEFAULT

// For initializing test
getData((new Node(null, "10", 101470000, 101480000)))

// GO
function go() {
  d3.selectAll("input,button").attr("disabled", true);
  let inputNode = getInputNode();
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
  /*
   * Gets data from the loading mode specified by 'loadingDataMode' variable.
   * Available loading modes are in 'LOADING_DATA_MODES'.
   */
  FORCE_SIMULATION.stop();
  GRAPH_VIEW.clear();

  console.log("Rendering from ", loadingDataMode);
  LOADING_DATA_MODES[loadingDataMode](parameters)
  d3.selectAll('input,button').attr('disabled', null);
}

function loadDataDatabase(parameters) {
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

function loadDataCsvLinksNodes(parameters) {
  /*
   * Loads CSV files for nodes and links.
   * If loading mode 'loadingDataMode' is from links ONLY, reads links CSV file
   * ONLY and nodes will be deduced from links. Else reads nodes from CSV file
   * too.
   * Sends links and nodes to the process function.
   */
  loadD3CsvData((loadingDataMode === 'csvLinks')
                ? [CSV_LINKS]
                : [CSV_LINKS, CSV_NODES])
    .await(processCsvLinksNodes(parameters))
}

function loadD3CsvData(csvFiles=[]) {
  /*
   * Reads and loads a list of CSV files in a d3 queue.
   * Returns the d3 queue to process.
   */
  const d3Queue = d3.queue()
  csvFiles.forEach(x => d3Queue.defer(d3.csv, x))
  return d3Queue
}

function processCsvLinksNodes(parameters) {
  /*
   * Processes CSV links and nodes.
   */
  return function (error, links, nodes) {
    if(error) { console.log(error); }
    updateGraph(filterCsvLinksNodes(links, nodes, parameters))
    renderGraph(parameters)
  }
}

function filterCsvLinksNodes(plinks, pnodes, parameters) {
  /*
   * Parses raw links and nodes.
   * If no nodes specified, exptrapolates the nodes relevant to each link.
   * Returns a dictionary of unique nodes and links.
   */
  let nodes = []
  let links = []
  let linkId = 0

  filterCsvLinksNeighbors(plinks, parameters, neighborLevelCurrent)
    .forEach(l => {
      pushUniqueObjectsByAttributes(
        links,
        [ formatCsvDataLink(l, linkId++)],
        GRAPH_VIEW.getLinkUniqueAttrs()
      )

      // Extrapolate and push nodes from current link 'l' if no nodes 'pnodes'
      // provided
      if (pnodes) return;
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

  // Push nodes if provided
  if (pnodes) {
    console.log("Nodes provided. No extrapolation from links");
    pushUniqueObjectsByAttributes(
      nodes,
      pnodes.map(n => formatCsvDataNode(
        new Node(null, n.chromosome, n.start, n.end))),
      GRAPH_VIEW.getNodeUniqueAttrs()
    )
  } else {
    console.log("No nodes provided. Extrapolation from links");
  }
  return {
    nodes: nodes,
    links: links
  }
}

function filterCsvLinksNeighbors(links, node, neighborCounter) {
  /*
   * Pushes CSV data 'links' which source and target nodes match the provided
   * 'node'.
   * Recursively finds neighboring nodes while 'neighborCounter' > 0
   */
  let flinks = []
  links.filter(l => {
    // Match source or target
     return ((l.sourceChromosome == node.chromosome
           && l.sourceStart == node.start
           && l.sourceEnd == node.end)
          || (l.targetChromosome == node.chromosome
           && l.targetStart == node.start
           && l.targetEnd == node.end))
     })
    .forEach(l => {
       // Push origin
       flinks.push(l)
       // console.log("[Node] ", node);
       // console.log("  Pushed link: ", l, " remains %d neighbors", neighborCounter);
       if ( neighborCounter > 0) {
         // Filter source node
         filterCsvLinksNeighbors(
             links,
             new Node(null, l.sourceChromosome,  l.sourceStart, l.sourceEnd),
             neighborCounter-1)
           .forEach(l => flinks.push(l))
         // Filter target node
         filterCsvLinksNeighbors(
               links,
               new Node(null, l.targetChromosome,  l.targetStart, l.targetEnd),
               neighborCounter-1)
             .forEach(l => flinks.push(l))
       }
    })
  return flinks
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
            return (attributes.filter(a => { return (o[a] === object[a]) } )
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
