import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import org.junit.jupiter.api.Test;

class DijkstraGraphTest {

  @Test
  void findsTheLeastCostPath() {
    DijkstraGraph<String, Integer> graph = new DijkstraGraph<>();
    graph.insertNode("start");
    graph.insertNode("middle");
    graph.insertNode("detour");
    graph.insertNode("finish");
    graph.insertEdge("start", "middle", 2);
    graph.insertEdge("middle", "finish", 3);
    graph.insertEdge("start", "detour", 1);
    graph.insertEdge("detour", "finish", 8);

    assertEquals(List.of("start", "middle", "finish"),
        graph.shortestPathData("start", "finish"));
    assertEquals(5.0, graph.shortestPathCost("start", "finish"));
  }
}
