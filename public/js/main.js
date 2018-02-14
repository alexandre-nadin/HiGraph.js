// Valutare dimensione dei numeri : https://github.com/neo4j/neo4j-javascript-driver#a-note-on-numbers-and-the-integer-type
// Leggere la sezione "A note on numbers and the Integer type" in fondo al readme.md
// Verificare se (2^53- 1) e' sufficiente per contenere gli indici dei nucleotidi nei cromosomi

const inputRegex = /^(X|Y|x|y|[0-9]|1[0-9]|2[0-2]):\d+-\d+$/;

const containerSelection = d3.select("#hicviz-container")

const navigationSelection = containerSelection.append("div")
  .attr("id", "navigation");

navigationSelection.append("input")
  .attr("id", "coordinates")
  .attr("type", "text")
  .attr("placeholder", "chr:start-end (example 10:103765000-103770000)");
navigationSelection.append("button")
  .attr("id", "go-button")
  .html("Go")
  .on("click", go);
navigationSelection.append("button")
  .attr("id", "zoom-out-button")
  .html("Zoom-Out")
  .on("click", increaseLevel);
navigationSelection.append("button")
  .attr("id", "zoom-in-button")
  .html("Zoom-In")
  .on("click", decreaseLevel);
navigationSelection.append("button")
  .attr("id", "refresh-button")
  .html("Refresh")
  .on("click", refresh);

const heatmapSelection = containerSelection.append("div")
  .attr("id", "heatmap");

const zoom = d3.zoom()
  .wheelDelta(myDelta)
  .on("zoom", zoom_actions);

const scale = 0.85;
const width = +containerSelection.attr("width");
const height = +containerSelection.attr("height") * scale;

const svgSelection = containerSelection.append("svg")
  .attr("id", "graph-container")
  .attr("width", width)
  .attr("height", height)
  .call(zoom);

let currentTransform = d3.zoomIdentity;

let linkSelection = svgSelection.append("g").selectAll(".link");
let nodeSelection = svgSelection.append("g").selectAll(".node");

const tooltip = containerSelection.append("div")
  .attr("id", "tooltip")
  .style("opacity", 0);

const graphView = new GraphView();

const forceSimulation = d3.forceSimulation(graphView.nodes)
  .force("charge", d3.forceManyBody())
  .force("link", d3.forceLink().id(d => d.id))
  .force("center", d3.forceCenter(width / 2, height / 2))
  .on("tick", tickActions);



// MY DELTA

function myDelta() {
  return -d3.event.deltaY * (d3.event.deltaMode ? 120 : 1) / 6000;
}



// ZOOM ACTIONS

function zoom_actions()
{
  linkSelection.attr("transform", d3.event.transform);
  nodeSelection.attr("transform", d3.event.transform);
  linkSelection.attr("stroke-width", 2/d3.event.transform.k);
  nodeSelection.attr("r", 8/d3.event.transform.k)
               .attr("stroke-width", 1/d3.event.transform.k);
  currentTransform = d3.event.transform;
}



// GO

function go()
{
  d3.selectAll("input,button").attr("disabled", true);

  let parameters = getCoordinates();

  if(!parameters)
  {
    window.alert("Wrong coordinates");
    d3.selectAll("input,button").attr("disabled", null);
    return;
  }

  svgSelection.call(zoom.transform, d3.zoomIdentity);
  graphView.resetLevel();

  let level = graphView.level;
  parameters.level = level;

  getData(parameters);
}



// REFRESH

function refresh()
{
  d3.selectAll("input,button").attr("disabled", true);

  if(graphView.root == null)
  {
    d3.selectAll("input,button").attr("disabled", null);
    return;
  }

  svgSelection.call(zoom.transform, d3.zoomIdentity);

  let chromosome = graphView.root.chromosome;
  let start      = graphView.root.start;
  let end        = graphView.root.end;
  let level      = graphView.level;
  let parameters = {chromosome: chromosome, start: start, end: end, level: level};

  getData(parameters);
}



// ZOOM IN

function decreaseLevel()
{
  d3.selectAll("input,button").attr("disabled", true);

  if(graphView.level == 0 || graphView.root == null)
  {
    d3.selectAll("input,button").attr("disabled", null);
    return;
  }

  graphView.decreaseLevel();

  let chromosome = graphView.root.chromosome;
  let start      = graphView.root.start;
  let end        = graphView.root.end;
  let level      = graphView.level;
  let parameters = {chromosome: chromosome, start: start, end: end, level: level};

  getData(parameters);
}



// ZOOM OUT

function increaseLevel()
{
  d3.selectAll("input,button").attr("disabled", true);

  if(graphView.root == null)
  {
    d3.selectAll("input,button").attr("disabled", null);
    return;
  }

  graphView.increaseLevel();

  let chromosome = graphView.root.chromosome;
  let start      = graphView.root.start;
  let end        = graphView.root.end;
  let level      = graphView.level;
  let parameters = {chromosome: chromosome, start: start, end: end, level: level};

  getData(parameters);
}



// GET PARAMETERS

function getCoordinates()
{
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
var DATA_MODES = {
  file: load_csv_data_nodes_links,
  database: load_database_data
};
var data_mode = 'file';


// d1 reading multiple files
const FILE_NODES = "../data/nodes.csv";
const FILE_LINKS = "../data/links.csv";

function get_csv_files(file_nodes, file_links) {
  // For tests
  d3.queue()
    .defer(d3.csv, file_nodes)
    .defer(d3.csv, file_links)
    .await(analyze);

  function analyze(error, nodes, links) {
    if(error) { console.log(error); }
    // console.log( {nodes: nodes, links: links});
    return {nodes: nodes, links: links};
  }
}

function get_default_parameters() {
  // For tests
  return {
      chromosome: "10",
      end: 101480000,
      level: 1,
      start: 101470000
    };
}

function load_csv_data_nodes_links(file_nodes, file_links, parameters=null) {
  load_csv_data_nodes(file_nodes, parameters);
  load_csv_data_links(file_links, parameters);
}

function load_csv_data_nodes(filename, parameters) {
  var id = 0;
  d3.csv(filename)
    .row(function(d) {
          return {
                 // id: id++,
                 id: String(d.chromosome + d.start + d.end),
                 chromosome: d.chromosome,
                 start: d.start,
                 end: d.end

      };;
    })
    .get(function(d) {
      console.log("data nodes:");
      console.log({nodes: d});
      updateGraph({nodes: d});
      renderGraph(parameters);
    });
}

function load_csv_data_links(filename, parameters) {
  var id = 0;
  d3.csv(filename)
    .row(function(d) {
          return {
              id: id++,
              source: String(d.sourceChromosome + d.sourceStart + d.sourceEnd),
              target: String(d.targetChromosome + d.targetStart + d.targetEnd),
              type: d.type,
              value: d.value
      };;
    })
    .get(function(d) {
      console.log("data links:");
      console.log({ nodes: [{}], links: d});
      updateGraph({ nodes: [{}], links: d});
      renderGraph(parameters);
    });
}

function load_database_data(parameters) {
  d3.request("http://localhost:3000/query")
    .header("Content-Type", "application/json")
    .mimeType("application/json")
    .response(xhr => JSON.parse(xhr.responseText))
    .post(JSON.stringify(parameters), (err, res) => {
        if(res == null)
        {
          window.alert("The region is not in the database");
        }
        else
        {
          updateGraph(res);
          renderGraph(parameters);
        }
    });
}

// GET DATA
function getData(parameters)
{
  console.log("parameters");
  console.log(parameters);
  forceSimulation.stop();
  graphView.clear();

  if(data_mode === "file") {
    load_csv_data_nodes_links(
      FILE_NODES+"_h1000",
      FILE_LINKS+"_h90",
      parameters=parameters
    );
  } else if (data_mode === "database") {
    load_database_data(parameters=parameters)
  }
  d3.selectAll('input,button').attr('disabled', null);
}

// UPDATE GRAPH
function updateGraph(data)
{
  if(data.nodes == null) return;
  for(i = 0; i < data.nodes.length; ++i)
  {
    let node = data.nodes[i];
    let id = node.id;
    let chromosome = node.chromosome;
    let start = node.start;
    let end = node.end;
    graphView.addNode(id, chromosome, start, end);
  }

  if(data.links == null) return;

  for(i = 0; i < data.links.length; ++i)
  {
    let link = data.links[i];
    let id = link.id;
    let source = link.source;
    let target = link.target;
    let type = link.type;
    let value = link.value;
    graphView.addLink(id, source, target, type, value);
  }
}



// RENDER GRAPH

function renderGraph(parameters)
{
  let chromosome = parameters.chromosome;
  let start = parameters.start;
  let end = parameters.end;

  graphView.updateRoot(chromosome, start, end);
  graphView.setColors();

  graphView.root.fx = width/2;
  graphView.root.fy = height/2;

  // Apply the general update pattern to the links.
  linkSelection = linkSelection.data(graphView.links, d => d.id);
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
  nodeSelection = nodeSelection.data(graphView.nodes, d => d.id);
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
    .on("mouseover", node_over_actions)
    .on("mouseout", node_out_actions)
    .on("click", node_click_actions)
    .merge(nodeSelection);

    // Update and restart the simulation.
    forceSimulation.force("link").links(graphView.links);
    forceSimulation.nodes(graphView.nodes);
    forceSimulation.alpha(1).restart();
}



// NODE OVER ACTIONS

function node_over_actions(node)
{
  tooltip.transition()
    .duration(200)
    .style("opacity", .9);

  tooltip.html("chr" + node.chromosome + "-" + node.start + "-" + node.end)
    .style("left", (d3.event.pageX) + "px")
    .style("top", (d3.event.pageY - 28) + "px");
}



// NODE OUT ACTIONS

function node_out_actions(node)
{
  tooltip.transition()
    .duration(200)
    .style("opacity", 0);
}



// NODE CLICK ACTIONS

function node_click_actions(node)
{
  let chromosome = node.chromosome;
  let start      = node.start;
  let end        = node.end;
  let level      = graphView.level;
  let parameters = {chromosome: chromosome, start: start, end: end, level: level};

  getData(parameters);
}



// TICK ACTIONS

function tickActions()
{
  linkSelection
    .attr("x1", d => d.source.x)
    .attr("y1", d => d.source.y)
    .attr("x2", d => d.target.x)
    .attr("y2", d => d.target.y);

  nodeSelection
    .attr("cx", d => d.x)
    .attr("cy", d => d.y);
}
