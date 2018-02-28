const NEIGHBOR_LEVEL_DEFAULT = 2
const NEIGHBOR_LEVEL_MIN = 0
const ZOOM_LEVEL_MIN = 0

class GraphView {
  constructor() {
    this.graph  = new Graph();
    this.root   = null;
    this.zoomLevel  = 1;
    this.neighborLevel = NEIGHBOR_LEVEL_DEFAULT
  }

  get nodes() { return this.graph.nodes }
  get links() { return this.graph.links }

  getNodeUniqueAttrs() {
    return ['id'] //'chromosome']
  }

  getLinkUniqueAttrs() {
    return ['source', 'target']
  }

  addNode(id, chromosome, start, end) {
    // if (this.graph.nodes.filter(x => x.id === id).length === 0)
    this.graph.addNode(id, chromosome, start, end)
  }

  addLink(id, source, target, type, weight) {
    this.graph.addLink(id, source, target, type, weight)
  }

  increaseZoomLevel() { ++this.zoomLevel }
  decreaseLevel() {
    if(this.zoomLevel === ZOOM_LEVEL_MIN) return null
    --this.zoomLevel
  }
  resetZoomLevel() { this.zoomLevel = ZOOM_LEVEL_MIN }

  increaseNeighborLevel() { ++this.neighborLevel }
  decreaseNeighborLevel() {
    if(this.neighborLevel === NEIGHBOR_LEVEL_MIN) return null
    --this.neighborLevel
  }

  clear() { this.graph.clear() }

  setColors() {
    this.graph.nodes.forEach((x) => x.color = "#ffffff")
    this.root.color = "red";

    let min = d3.min(this.graph.links, d => d.weight);
    let max = d3.max(this.graph.links, d => d.weight);
    let heatmapColor = d3.scaleLog()
      //.domain([min, min+(max-min)/2, max])
      //.range(["red", "yellow", "white"]);
      .domain([min, max])
      //.range(["#6363FF",  "#FF6364"]);
      .range(["#03a9f4",  "#ff6f00"]);

    this.graph.links.forEach(x => x.color = heatmapColor(x.weight))
  }

  updateRoot(chromosome, start, end) {
    this.root = this.graph.nodes.find(
      x => x.chromosome == chromosome
             && x.start == start
             && x.end == end)

    // This does not change much if is is undefined or null, error will ensue
    this.root = (this.root === undefined)
        ? null
        : this.root
    return
  }

  formatNode(node) {
    return Object.assign(
      {}, node, {level: (node.level === undefined)
                        ? this.zoomLevel
                        : node.level}
    )
  }

  getFormattedRoot() { return this.formatNode(this.root) }
}
