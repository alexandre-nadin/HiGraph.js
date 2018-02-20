class Graph
{
  constructor()
  {
    this.nodes = [];
    this.links = [];
  }

  addNode(id, chromosome, start, end) { this.nodes.push(new Node(id, chromosome, start, end)) }
  addLink(id, source, target, type, weight) { this.links.push(new Link(id, source, target, type, weight)) }

  clear()
  {
    while(this.nodes.length > 0) this.nodes.pop();
    while(this.links.length > 0) this.links.pop();
  }
}
