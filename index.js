var async = require('async');
var _ = require('underscore');
var extend = require('extend');
var async = require('async');

module.exports = sections;

function sections(options, callback) {
  return new sections.Sections(options, callback);
}

// Everything in this constructor that should really be in an apostrophe-modules
// metamodule is marked REFACTOR. -Tom

sections.Sections = function(options, callback) {
  var self = this;

  // "Protected" properties. We want related modules and subclasses to be able
  // to access these, thus no variables defined in the closure
  self._apos = options.apos;
  self._pages = options.pages;
  self._app = options.app;
  self._options = options;

  // REFACTOR self.modules allows us to find the directory path and web asset path to
  // each module in the inheritance tree when subclassing. Necessary to push all
  // relevant assets to the browser and to implement template overrides.
  //
  // The final subclass appears at the start of the list, which is right for a
  // chain of template overrides
  self._modules = (options.modules || []).concat([ { dir: __dirname, name: 'sections' } ]);

  // REFACTOR Compute the web directory name for use in asset paths
  _.each(self._modules, function(module) {
    module.web = '/apos-' + self._apos.cssName(module.name);
  });

  // REFACTOR The same list in reverse order, for use in pushing assets (all versions of the
  // asset file are pushed to the browser, starting with the snippets class, because
  // CSS and JS are cumulative and CSS is very order dependent)
  //
  // Use slice(0) to make sure we get a copy and don't alter the original
  self._reverseModules = self._modules.slice(0).reverse();

  // All partials generated via self.renderer can see these properties
  self._rendererGlobals = options.rendererGlobals || {};

  self._action = '/apos-sections';

  // Render a partial, looking for overrides in our preferred places REFACTOR
  self.render = function(name, data) {
    return self.renderer(name)(data);
  };

  // Return a function that will render a particular partial looking for overrides in our
  // preferred places. Also merge in any properties of self._rendererGlobals, which can
  // be set via the rendererGlobals option when the module is configured
  // REFACTOR

  self.renderer = function(name) {
    return function(data) {
      if (!data) {
        data = {};
      }
      _.defaults(data, self._rendererGlobals);
      return self._apos.partial(name, data, _.map(self._modules, function(module) { return module.dir + '/views'; }));
    };
  };

  // REFACTOR
  self.pushAsset = function(type, name) {
    if (type === 'template') {
      // Render templates in our own nunjucks context
      self._apos.pushAsset('template', self.renderer(name));
    } else {
      // We're interested in ALL versions of main.js or main.css, starting
      // with the base one (this module's version)

      _.each(self._reverseModules, function(module) {
        return self._apos.pushAsset(type, name, module.dir, module.web);
      });
    }
  };

  self._apos.addLocal('aposSectionGroup', function(options) {
    return self.render('sectionGroup', options);
  });

  // Sections UI is all on the browser side, with just one API function to support
  // saving an entire section group. We can get away with that since the areas are
  // stored separately

  self._app.post(self._action + '/save', function(req, res) {
    var page;
    var name = self._apos.sanitizeString(req.body.name, '');
    if (!name.length) {
      return callback('section group name required');
    }
    if (name !== self._apos.slugify(name)) {
      return callback('section group name must be sluggable');
    }
    var slug = self._apos.sanitizeString(req.body.slug, '');
    if (!slug.length) {
      return callback('page slug must be provided');
    }
    var submitted;
    var sectionGroup = {};
    // Sanitize what they sent
    try {
      submitted = JSON.parse(req.body.sectionGroup);
      sectionGroup.sections = [];
      _.each(submitted.sections, function(submittedSection) {
        var section = {};
        section.title = self._apos.sanitizeString(submittedSection.title);
        section._id = self._apos.sanitizeString(submittedSection._id);
        if (!section.title.length) {
          throw 'Titles may not be blank';
        }
        if (!section._id.length) {
          throw 'IDs may not be blank';
        }
        if (section._id !== self._apos.slugify(section._id)) {
          throw 'Invalid section id';
        }
        sectionGroup.sections.push(section);
      });
    } catch (e) {
      return callback(e);
    }
    return async.series([ getPage, permissions, add], done);
    function getPage(callback) {
      return self._apos.getPage(req, slug, function(err, pageArg) {
        if (err) {
          return callback(err);
        }
        if (!pageArg) {
          return callback('page not found');
        }
        page = pageArg;
        return callback(null);
      });
    }
    function permissions(callback) {
      return self._apos.permissions(req, 'edit-page', page, function(err) {
        return callback(err);
      });
    }
    function add(callback) {
      // Set up a flexible structure with room for options etc. later
      if (!page.sectionGroups) {
        page.sectionGroups = {};
      }
      page.sectionGroups[name] = sectionGroup;
      self._apos.putPage(req, slug, page, callback);
    }
    function done(err) {
      return res.send(page.sectionGroups[name]);
    }
  });

  // Construct our browser side object REFACTOR
  var browserOptions = options.browser || {};

  // The option can't be .constructor because that has a special meaning
  // in a javascript object (not the one you'd expect, either) http://stackoverflow.com/questions/4012998/what-it-the-significance-of-the-javascript-constructor-property
  var browser = {
    pages: browserOptions.pages || 'aposPages',
    construct: browserOptions.construct || 'AposSections'
  };

  self._apos.pushGlobalCall('window.aposSections = new @(?)', browser.construct, { action: self._action });

  self.pushAsset('script', 'main');
  self.pushAsset('stylesheet', 'main');

  // Serve our static assets REFACTOR
  _.each(self._modules, function(module) {
    self._app.get(module.web + '/*', self._apos.static(module.dir + '/public'));
  });

  if (callback) {
    // Invoke callback on next tick so that the constructor's return
    // value can be assigned to a variable in the same closure where
    // the callback resides
    process.nextTick(function() { return callback(null); });
  }
};
