import { addItemsWithLimit } from "../src/utils.js";

describe("utility functions", () => {
  describe("#addItemsWithLimit", () => {
    it("should not crash when adding half a million items with no limit", () => {
      const mainList = [1, 2, 3];
      const newItems = Array(500000).fill(4);
      addItemsWithLimit(newItems, mainList, 0);
      expect(mainList).toHaveLength(500003);
    });
  });
});
