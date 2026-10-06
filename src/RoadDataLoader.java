import java.io.BufferedReader;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.OptionalDouble;
import java.util.Set;

/** Reads and validates the location and road CSV files used by the project. */
public final class RoadDataLoader {

  private static final List<String> LOCATION_COLUMNS =
      List.of("id", "name", "lat", "lon", "query", "source", "retrieved_at");
  private static final List<String> ROAD_COLUMNS =
      List.of("from", "to", "walkMiles", "driveMiles", "hasSteps", "maxInclinePercent",
          "accessibleMiles", "busRoute");

  public record Location(String id, String name, double latitude, double longitude) {}

  public record Road(String from, String to, double walkMiles, OptionalDouble driveMiles,
      boolean hasSteps, double maxInclinePercent, OptionalDouble accessibleMiles, String busRoute) {}

  public record Dataset(List<Location> locations, List<Road> roads) {
    public Dataset {
      locations = List.copyOf(locations);
      roads = List.copyOf(roads);
    }
  }

  /** Loads both CSV files and checks that road endpoints refer to known locations. */
  public Dataset load(Path locationsFile, Path roadsFile) throws IOException {
    List<Location> locations = readLocations(locationsFile);
    List<Road> roads = readRoads(roadsFile, locations);
    return new Dataset(locations, roads);
  }

  private List<Location> readLocations(Path file) throws IOException {
    List<List<String>> rows = readTable(file, LOCATION_COLUMNS);
    List<Location> locations = new ArrayList<>();
    Set<String> ids = new HashSet<>();

    for (int rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
      List<String> row = rows.get(rowIndex);
      int line = rowIndex + 2;
      String id = required(row.get(0), file, line, "id");
      String name = required(row.get(1), file, line, "name");
      if (!ids.add(id)) {
        throw invalid(file, line, "duplicate location id '" + id + "'");
      }
      double latitude = number(row.get(2), file, line, "lat");
      double longitude = number(row.get(3), file, line, "lon");
      if (latitude < -90 || latitude > 90) {
        throw invalid(file, line, "latitude must be between -90 and 90");
      }
      if (longitude < -180 || longitude > 180) {
        throw invalid(file, line, "longitude must be between -180 and 180");
      }
      locations.add(new Location(id, name, latitude, longitude));
    }
    return locations;
  }

  private List<Road> readRoads(Path file, List<Location> locations) throws IOException {
    List<List<String>> rows = readTable(file, ROAD_COLUMNS);
    Map<String, Location> locationsById = new HashMap<>();
    for (Location location : locations) {
      locationsById.put(location.id(), location);
    }

    List<Road> roads = new ArrayList<>();
    Set<String> directedEdges = new HashSet<>();
    for (int rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
      List<String> row = rows.get(rowIndex);
      int line = rowIndex + 2;
      String from = required(row.get(0), file, line, "from");
      String to = required(row.get(1), file, line, "to");
      if (!locationsById.containsKey(from)) {
        throw invalid(file, line, "unknown location id '" + from + "'");
      }
      if (!locationsById.containsKey(to)) {
        throw invalid(file, line, "unknown location id '" + to + "'");
      }
      if (!directedEdges.add(from + "\u0000" + to)) {
        throw invalid(file, line, "duplicate directed road '" + from + "' to '" + to + "'");
      }

      double walkMiles = nonNegativeNumber(row.get(2), file, line, "walkMiles");
      OptionalDouble driveMiles = optionalNonNegativeNumber(row.get(3), file, line, "driveMiles");
      boolean hasSteps = bool(row.get(4), file, line, "hasSteps");
      double maxIncline = nonNegativeNumber(row.get(5), file, line, "maxInclinePercent");
      OptionalDouble accessibleMiles =
          optionalNonNegativeNumber(row.get(6), file, line, "accessibleMiles");
      roads.add(new Road(from, to, walkMiles, driveMiles, hasSteps, maxIncline,
          accessibleMiles, row.get(7).trim()));
    }
    return roads;
  }

  private List<List<String>> readTable(Path file, List<String> expectedColumns) throws IOException {
    try (BufferedReader reader = Files.newBufferedReader(file)) {
      String header = reader.readLine();
      if (header == null) {
        throw invalid(file, 1, "file is empty");
      }
      List<String> actualColumns = parseRecord(header, file, 1);
      if (!actualColumns.equals(expectedColumns)) {
        throw invalid(file, 1, "expected columns " + expectedColumns + " but found " + actualColumns);
      }

      List<List<String>> rows = new ArrayList<>();
      String line;
      int lineNumber = 1;
      while ((line = reader.readLine()) != null) {
        lineNumber++;
        if (line.isBlank()) {
          continue;
        }
        List<String> fields = parseRecord(line, file, lineNumber);
        if (fields.size() != expectedColumns.size()) {
          throw invalid(file, lineNumber,
              "expected " + expectedColumns.size() + " columns but found " + fields.size());
        }
        rows.add(fields);
      }
      return rows;
    }
  }

  private List<String> parseRecord(String line, Path file, int lineNumber) throws IOException {
    List<String> fields = new ArrayList<>();
    StringBuilder field = new StringBuilder();
    boolean quoted = false;
    boolean quoteClosed = false;

    for (int i = 0; i < line.length(); i++) {
      char current = line.charAt(i);
      if (quoted) {
        if (current == '"') {
          if (i + 1 < line.length() && line.charAt(i + 1) == '"') {
            field.append('"');
            i++;
          } else {
            quoted = false;
            quoteClosed = true;
          }
        } else {
          field.append(current);
        }
      } else if (current == ',') {
        fields.add(field.toString());
        field.setLength(0);
        quoteClosed = false;
      } else if (current == '"' && field.isEmpty() && !quoteClosed) {
        quoted = true;
      } else if (quoteClosed && !Character.isWhitespace(current)) {
        throw invalid(file, lineNumber, "unexpected character after a quoted field");
      } else if (!quoteClosed) {
        field.append(current);
      }
    }

    if (quoted) {
      throw invalid(file, lineNumber, "unterminated quoted field");
    }
    fields.add(field.toString());
    return fields;
  }

  private String required(String value, Path file, int line, String column) throws IOException {
    String trimmed = value.trim();
    if (trimmed.isEmpty()) {
      throw invalid(file, line, "'" + column + "' must not be empty");
    }
    return trimmed;
  }

  private double number(String value, Path file, int line, String column) throws IOException {
    try {
      double parsed = Double.parseDouble(value.trim());
      if (!Double.isFinite(parsed)) {
        throw new NumberFormatException("not finite");
      }
      return parsed;
    } catch (NumberFormatException exception) {
      throw invalid(file, line, "'" + column + "' must be a finite number");
    }
  }

  private double nonNegativeNumber(String value, Path file, int line, String column)
      throws IOException {
    double parsed = number(value, file, line, column);
    if (parsed < 0) {
      throw invalid(file, line, "'" + column + "' must not be negative");
    }
    return parsed;
  }

  private OptionalDouble optionalNonNegativeNumber(String value, Path file, int line,
      String column) throws IOException {
    if (value.isBlank()) {
      return OptionalDouble.empty();
    }
    return OptionalDouble.of(nonNegativeNumber(value, file, line, column));
  }

  private boolean bool(String value, Path file, int line, String column) throws IOException {
    return switch (value.trim().toLowerCase()) {
      case "true" -> true;
      case "false" -> false;
      default -> throw invalid(file, line, "'" + column + "' must be true or false");
    };
  }

  private IOException invalid(Path file, int line, String message) {
    return new IOException(file + ":" + line + ": " + message);
  }
}
