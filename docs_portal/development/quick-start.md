# Quick Start

```text
_**Note: The fork we have of the VIS library is from an unmaintained and already archived project, so it is not recommended to use it in new components.**_
```

To use VIS.js within the Framework, we would need to import the library, as in the example below, and use one of the new instances created, depending on the desired use:

```sh
import vis from 'vis';

const timeline = new vis.TimelineChart(target, [], [], {}, {});
const timeline = new vis.Timeline(target, [], [], {});
```
