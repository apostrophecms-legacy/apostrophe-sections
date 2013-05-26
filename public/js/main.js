function AposSections(options) {
  self._action = options.action || '/apos-sections';
  self.enableSections = function() {
    $('[data-section-group]').each(function() {
      var $group = $(this);
      var name = $(this).attr('data-section-group');
      if ($group.data('enabled')) {
        return;
      }
      $group.data('enabled', true);

      $group.find('[data-sections]').sortable({
        handle: '.apos-section-handle',
        // cursorAt: { top:0, left: 0 },
        // tolerance: "pointer",
        sort: function( event, ui ) {
          $('[data-section]').each(function(){
            $(this).addClass('apos-section-collapse');
          });
          $(this).sortable('refreshPositions');

        },
        stop: function( event, ui ) {
          $('[data-section]').each(function(){
            $(this).removeClass('apos-section-collapse');
          });
          $(this).sortable('refreshPositions');
        },
        'update': function() {
          var $group = $(this).closest('[data-section-group]');
          self.commit($group);
          return true;
        }
      });


      var $sections = $group.find('[data-section]');
      var $addForm = $(this).find('[data-add-section]');

      // You can use something like this to do a smooth scroll to your section
      // on nav click, however I needed something a bit more custom at the project level
      // - Stuart
      
      // $group.find('[data-section-anchor]').on('click', function() {
      //   event.preventDefault();
      //   var $self = $(this);
      //   var section = $self.attr('href').split('#section');
      //   $('html, body').animate({
      //     scrollTop: $('[data-section="'+section[1]+'"]').offset().top
      //    }, 1000);
      //   return false;
      // });


      $group.find('[data-add-button]').on('click', function() {
        var $title = $addForm.find('[name="title"]');
        $title.val('');
        $addForm.toggle();
        $title.focus();
        return false;
      });

      $addForm.find('[data-save-new-section]').on('click', function() {
        var id = apos.generateId();
        var $section = $addForm.find('[data-section]').clone();
        $section.find('[data-title-text]').text($addForm.findByName('title').val());
        $section.find('[data-title-anchor]').attr('name', id);
        var $area = $section.find('.apos-area');
        $area.attr('data-slug', $area.attr('data-slug').replace('NEW', id));
        $section.attr('data-section', id);
        $group.find('[data-sections]').append($section);
        $addForm.hide();
        self.commit($group);
        return false;
      });
      $addForm.find('[name="title"]').on('keydown', function(e) {
        if (e.which === 13) {
          $(this).closest('[data-add-section]').find('[data-save-new-section]').trigger('click');
          return false;
        }
        return true;
      });
      $addForm.find('[data-cancel]').on('click', function() {
        $addForm.hide();
        return false;
      });
      $group.on('click', '[data-section] [data-remove-button]', function() {
        var remove = confirm("Are you sure you want to remove this Section?");
        if (remove === true)
          {
            var $section = $(this).closest('[data-section]');
            $section.remove();
            self.commit($group);
            return false;
          }
        else
          {
            return false;
          }
      });
      $group.on('click', '[data-section] [data-edit-button]', function() {
        var $section = $(this).closest('[data-section]');

        // do a check to see if we're already editing
        if ($section.find('[data-edit-section]').css('display') === 'block'){
          return false;
        }
        
        $section.find('[data-edit-section]').toggle();
        $section.find('[data-title-text]').hide();
        $section.find('[data-edit-section] [name="title"]').val($section.find('[data-title-text]').text());
        return false;
      });
      $group.on('click', '[data-edit-section] [data-cancel]', function() {
        var $section = $(this).closest('[data-section]');
        $section.find('[data-edit-section]').hide();
        $section.find('[data-title-text]').show();
        return false;
      });
      $group.on('click', '[data-edit-section] [data-save-section]', function() {
        var $section = $(this).closest('[data-section]');
        $section.find('[data-title-text]').text($section.find('[name="title"]').val());
        $(this).closest('[data-edit-section]').hide();
        $section.find('[data-title-text]').show();
        self.commit($group);
        return false;
      });
      $group.on('keydown', '[data-edit-section] [name="title"]', function(e) {
        if (e.which === 13) {
          $(this).closest('[data-edit-section]').find('[data-save-section]').trigger('click');
          return false;
        }
        return true;
      });
    });
  };
  self.enableSections();

  self._busyCount = 0;
  self.busy = function($group, status) {
    if (status) {
      self._busyCount++;
    } else {
      self._busyCount--;
    }
    if (self._busyCount) {
      $group.find('[data-busy]').show();
    } else {
      $group.find('[data-busy]').hide();
    }
  };

  self.commit = function($group) {
    // Serialize and save to the server
    var name = $group.attr('data-section-group');
    var $sections = $group.find('[data-sections] [data-section]');
    var sectionGroup = { sections: [] };
    _.each($sections, function(section) {
      var $section = $(section);
      sectionGroup.sections.push({ _id: $section.attr('data-section'), title: $section.find('[data-title-text]').text() });
    });
    self.busy($group, true);
    $.post(self._action + '/save', { name: name, slug: $group.attr('data-slug'), sectionGroup: JSON.stringify(sectionGroup) }, function(data) {
      self.busy($group, false);
    });
    // Refresh the tabs to match the current content
    var $links = $group.find('[data-section-links]');
    $links.html('');
    _.each(sectionGroup.sections, function(section) {
      var $link = $group.find('[data-template-links] [data-section-link]').clone();
      var $anchor = $link.find('[data-section-anchor]');
      $anchor.text(section.title);
      $anchor.attr('href', '#section' + section._id);
      $links.append($link);
    });
  };
}
