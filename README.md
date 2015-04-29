# WidGet Loader

 > Widget loader/middleware for WidGet CMS. 


### Installation

```
npm install widget-loader
```

### Example


```
var widgetLoader = require('widget-loader');
var express = require('express');
var app = express();
var widgetDir = path.join(__dirname, './widgets');



app.use(widgetLoader({
  App: app,
  widgetDir: widgetDir
}))

```