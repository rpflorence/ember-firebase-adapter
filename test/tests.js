QUnit.config.autostart = false;
QUnit.config.reorder = false;

var fb = new Firebase("https://" + window.DB_NAME + ".firebaseio.com")

var Person = DS.Firebase.LiveModel.extend({
  firstName: DS.attr('string'),
  lastName: DS.attr('string'),
  twitter: DS.attr('string'),
  github: DS.attr('string')
});

Person.toString = function() {
  return "App.Person";
};

module('CRUD Operations', {
  setup: function() {
    // reset firebase
    stop();
    fb.remove();

    this.adapter = DS.Firebase.Adapter.create({
      dbName: window.DB_NAME
    });

    this.store = DS.Store.create({
      adapter: this.adapter,
      revision: 12
    });

    start();
  },

  populate: function() {
    this.yehudaId = fb.child("persons").push({
      firstName: "Yehuda",
      lastName: "Katz",
      twitter: "wycats"
    }).name();
    fb.child("persons").push({
      firstName: "Tom",
      lastName: "Dale",
      twitter: "tomdale"
    });
  },

  teardown: function() {
    stop();

    // TODO: shouldn't destroying the adapter kill event listeners?
    // (also, you'd think fb.off() would kill all listeners, but it doesn't.
    // possible fb bug?)
    this.adapter.fb.child("persons").off("child_added");
    this.adapter.fb.child("persons").off("child_changed");
    this.adapter.fb.child("persons").off("child_removed");

    Ember.run.sync();
    Ember.run(function() {
      this.adapter.destroy();
      this.store.destroy();
      start();
    }.bind(this));
  }
});

asyncTest("Creating records", function() {
  expect(1);

  var fix = {
    firstName: "Yehuda",
    lastName: "Katz",
    twitter: "wycats"
  };
  
  var newPerson = Person.createRecord(fix);
  this.store.commit();

  fb.child("persons").child(newPerson.get("id")).once("value", function(snap) {
    deepEqual(snap.val(), fix, "Creating a record initializes a new Firebase record with correctly-set properties.");
    newPerson.disableBindings();
    start();
  });
});

asyncTest("Finding records by id", function() {
  expect(2);

  this.populate();

  var person = Person.find(this.yehudaId);
  person.on("didLoad", function() {
    equal(person.get("firstName"), "Yehuda", "Finding a record populates it with correct properties");
    equal(person.get("id"), this.yehudaId, "Finding a record populates it with the correct ID");
    person.disableBindings();
    start();
  }.bind(this));
});

asyncTest("Finding all records in a resource", function() {
  expect(2);

  this.populate();

  var people = Person.find();

  people.addObserver("length", function() {
    if (people.get("length") == 2) {
      equal(people.objectAt(0).get("id"), this.yehudaId, "Records are loaded in order of their keys");
      equal(people.objectAt(1).get("firstName"), "Tom", "All records are properly loaded");
      people.forEach(function(person) {person.disableBindings()});
      start();
    }
  }.bind(this))
});

asyncTest("Updating records", function() {
  expect(1);

  this.populate();

  var yehuda = Person.find(this.yehudaId);

  yehuda.on("didLoad", function() {
    yehuda.set("github", "wycats");

    yehuda.on("didUpdate", function() {
      fb.child("persons").child(this.yehudaId).once("value", function(snap) {
        equal(snap.val().github, "wycats", "Updating a model's property updates the back-end resource");
        yehuda.disableBindings();
        start();
      });
    }.bind(this));

    this.store.commit();
  }.bind(this));
});

asyncTest("Deleting records", function() {
  expect(1);

  this.populate();

  var yehuda = Person.find(this.yehudaId);

  yehuda.on("didLoad", function() {
    yehuda.deleteRecord();
    this.store.commit();

    // TODO: for some reason, on(child_removed) is triggering for prior
    // deletion from teardown before yehudaId.
    var ignoredFirst = false;
    fb.child("persons").on("child_removed", function(snap) {
      if (!ignoredFirst) {
        ignoredFirst = true;
        return;
      }
      equal(snap.name(), this.yehudaId, "Deleting a record removes it from Firebase");
      start();
    }.bind(this));
  }.bind(this));
});

module('Live property updates', {
  setup: function() {
    // reset firebase
    fb.remove();

    this.adapter = DS.Firebase.Adapter.create({
      dbName: window.DB_NAME
    });

    this.store = DS.Store.create({
      adapter: this.adapter,
      revision: 12
    });
  },

  populate: function() {
    this.yehuda = Person.createRecord({
      firstName: "Yehuda",
      lastName: "Katz",
      twitter: "wycats",
    });

    this.store.commit();
  },

  teardown: function() {
    stop();
    this.adapter.fb.child("persons").off();
    this.yehuda = null;

    Ember.run.sync();
    Ember.run(function() {
      this.adapter.destroy();
      this.store.destroy();
      start();
    }.bind(this));
  }
});

asyncTest("Properties can be added on the back-end", function() {
  expect(1);

  this.populate();

  this.yehuda.one("didUpdate", function() {
    equal(this.get("github"), "wycats", "A property added on Firebase will be added to the model");
    this.disableBindings();
    start();
  });

  fb.child("persons").child(this.yehuda.get("id")).child("github").set("wycats");
});

asyncTest("Properties can be updated on the back-end", function() {
  expect(1);

  this.populate();

  this.yehuda.one("didUpdate", function() {
    equal(this.get("twitter"), "yehuda_katz", "A property changed on Firebase will be changed on the model");
    this.disableBindings();
    start();
  });

  // make sure model has synced back to the server before setting a direct property.
  setTimeout(function() {
    fb.child("persons").child(this.yehuda.get("id")).child("twitter").set("yehuda_katz");
  }.bind(this), 250);
});

asyncTest("Properties can be removed on the back-end", function() {
  expect(1)

  this.populate();

  this.yehuda.one("didUpdate", function() {
    equal(this.get("twitter"), null, "A property removed on Firebase will be removed on the model");
    this.disableBindings();
    start();
  });

  setTimeout(function() {
    fb.child("persons").child(this.yehuda.get("id")).child("twitter").remove();
  }.bind(this), 250);
});

/*module('Embedded associations', {
  setup: function() {
  },
  teardown: function() {
  }
});

test("Embedded hasMany is loaded when its parent is read", function() {});
test("When an embedded model is created, its parent is updated", function() {});
test("When an embedded model is updated, its parent is updated", function() {});
test("When an embedded model is deleted, its parent is updated", function() {});

module("Embedded live associations", {
  setup: function() {
  },
  teardown: function() {
  }
});

module('Relational associations', {
  setup: function() {
  },
  teardown: function() {
  }
});*/

QUnit.start();
