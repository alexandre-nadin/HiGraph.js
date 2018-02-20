class GraphView {
  constructor() {
    this.graph  = new Graph();
    this.root   = null;
    this.level  = 1;
  }

  get nodes() { return this.graph.nodes }
  get links() { return this.graph.links }

  addNode(id, chromosome, start, end) {
    this.graph.addNode(id, chromosome, start, end)
  }
  addLink(id, source, target, type, weight) {
    this.graph.addLink(id, source, target, type, weight)
  }

  increaseLevel() { ++this.level }
  decreaseLevel() { --this.level }
  resetLevel()    { this.level = 1 }

  clear() { this.graph.clear() }

  setColors() {
    this.graph.nodes.forEach((x) => x.color = "#ffffff")
    this.root.color = "red";

    let min = d3.min(this.graph.links, d => d.weight);
    let max = d3.max(this.graph.links, d => d.weight);
    var heatmapColor = d3.scaleLog()
      //.domain([min, min+(max-min)/2, max])
      //.range(["red", "yellow", "white"]);
      .domain([min, max])
      //.range(["#6363FF",  "#FF6364"]);
      .range(["#03a9f4",  "#ff6f00"]);

    this.graph.links.forEach(x => x.color = heatmapColor(x.weight))
  }

  updateRoot(chromosome, start, end) {
    let nodes = this.graph.nodes;
    for(let i = 0; i < nodes.length; ++i) {
      let node = nodes[i];
      console.log(" node: %s", node.chromosome);
      if(node.chromosome == chromosome, node.start == start, node.end == end) {
        this.root = node;
        return;
      }
    }
    this.root = null;
  }
}
