/**
 * Blob-select Vue Component
 *
 * This is very similar to the vanilla JS implementation except a lot
 * of the heavy-lifting is off-loaded to Vue. For projects that already
 * depend on Vue, this is a lighter alternative.
 *
 * @version 2.1.0
 * @author Blobfolio, LLC <hello@blobfolio.com>
 * @package vue-blob-forms
 * @license WTFPL <http://www.wtfpl.net>
 *
 * @see https://blobfolio.com
 * @see https://github.com/Blobfolio/vue-blob-select
 */

/* global Vue */
(function() {

	// -----------------------------------------------------------------
	// Utility
	// -----------------------------------------------------------------

	/**
	 * Debounce
	 *
	 * @param {function} fn Callback.
	 * @param {bool} wait Wait.
	 * @param {bool} no_postpone Do it now.
	 * @returns {callback} Wrapper function.
	 */
	const _debounce = function(fn, wait, no_postpone) {
		let args;
		let context;
		let result;
		let timeout;
		let executed = true;

		/**
		 * Ping
		 *
		 * @returns {void} Nothing.
		 */
		function ping() {
			result = fn.apply(context || this, args || []);
			context = args = null;
			executed = true;
		}

		/**
		 * Cancel Timeout
		 *
		 * @returns {void} Nothing.
		 */
		function cancel() {
			if (timeout) {
				clearTimeout(timeout);
				timeout = null;
			}
		}

		/**
		 * Wrapper
		 *
		 * @returns {void} Nothing.
		 */
		function wrapper() {
			context = this;
			args = arguments;
			if (! no_postpone) {
				cancel();
				timeout = setTimeout(ping, wait);
			}
			else if (executed) {
				executed = false;
				timeout = setTimeout(ping, wait);
			}
		}

		// Reset.
		wrapper.cancel = cancel;
		return wrapper;
	};



	// -----------------------------------------------------------------
	// Component
	// -----------------------------------------------------------------

	const blobSelect = {
		/**
		 * Data
		 *
		 * @returns {object} Data.
		 */
		data: function() {
			return {
				focus: 0,
				init: false,
				minItemKey: 0,
				maxItemKey: 0,
				searchValue: '',
				state: 'closed',
				timeout: null,
			};
		},

		// Settings.
		props: {
			// An ID for the input.
			id: {
				type: String,
				default: '',
			},
			// A name for the input.
			name: {
				type: String,
				default: '',
			},
			// For model-binding.
			value: {
				type: [Number, String, Array],
				default: 0,
			},
			// An array of items.
			items: {
				type: Array,
				default: [],
			},
			// Disable the whole <blob-select>.
			disabled: {
				type: Boolean,
				default: false,
			},
			// Allow multiple selections.
			multiple: {
				type: Boolean,
				default: false,
			},
			// Allow null selections and show a placeholder.
			placeholder: {
				type: Boolean,
				default: false,
			},
			// Require a selection.
			required: {
				type: Boolean,
				default: false,
			},
			// Add a search field for item filtering.
			search: {
				type: Boolean,
				default: false,
			},
			// Resort items ASCending or DESCending.
			sort: {
				type: String,
				default: '',
			},
			// A placeholder to display when no selection is made.
			fieldPlaceholder: {
				type: String,
				default: '---',
			},
			// The label to use for placeholder pseudo-<option>s.
			labelPlaceholder: {
				type: String,
				default: '---',
			},
			// Treat labels as either a string or number, mostly for
			// sorting.
			labelType: {
				type: String,
				default: 'string',
			},
			// Treat values as either a string or number.
			valueType: {
				type: String,
				default: 'string',
			},
		},

		// Methods.
		methods: {
			/**
			 * Toggle Select
			 *
			 * @param {string} force Force.
			 * @returns {void} Nothing.
			 */
			toggleState: function(force) {
				if (this.timeout) {
					clearTimeout(this.timeout);
					this.timeout = null;
					this.state = 'open';
				}

				// Can't do anything but close if this is disabled.
				if (this.disabled) {
					force = 'closed';
				}
				// Toggle if needs toggling.
				else if (
					! force ||
					(('open' !== force) && ('closed' !== force))
				) {
					force = ('closed' === this.state) ? 'open' : 'closed';
				}

				// No change?
				if (force === this.state) {
					return;
				}

				// Open happens in two quick stages.
				if ('open' === force) {
					// Start by closing any other open selects on the
					// page.
					_closeOthers(this.$el);

					this.state = 'opening';
					let vue = this;
					this.timeout = setTimeout(function() {
						vue.state = 'open';
						vue.timeout = null;

						// Assign focus to the search field.
						if (vue.search) {
							const field = vue.$el.querySelector('.blobselect-item-search');
							field.innerHTML = vue.searchValue;
							_cursorToEnd(field);
						}

						vue.resetFocus();
					}, 50);
				}
				// Closing happens right away.
				else {
					this.state = 'closed';
					this.$el.focus();
				}
			},

			/**
			 * Key Bindings
			 *
			 * @param {event} e Event.
			 * @returns {void} Nothing.
			 */
			toggleKeyState: function(e) {
				const keyCode = e.keyCode;
				const keyMapped = keyMap[keyCode] || false;

				// For closed menus, almost any key means Open Up!
				if ('open' !== this.state) {
					if (
						! keyMapped ||
						(('tab' !== keyMapped) && ('backspace' !== keyMapped))
					) {
						e.stopPropagation();

						// Should we try to append the keystroke to the
						// search field?
						if (this.search && _isPrintableKey(keyCode)) {
							this.searchValue += String.fromCharCode(keyCode).toLowerCase();
							this.$el.querySelector('.blobselect-item-search').textContent = this.searchValue;
						}

						// Explicitly match "closed" because we could be
						// living in the few millisecond so of an
						// "is-opening" transition.
						if ('closed' === this.state) {
							this.toggleState('open');
						}
					}
				}
				// Always close on escape.
				else if ('escape' === keyMapped) {
					e.stopPropagation();
					this.toggleState('closed');
				}
				// Make a selection maybe.
				else if ('enter' === keyMapped) {
					e.stopPropagation();
					e.preventDefault();

					// If we were in the search form, select the first.
					if (e.target.classList.contains('blobselect-item-search')) {
						this.selectFirst();
					}
					else {
						this.selectFocused();
					}
				}
				// Navigation.
				else if (-1 !== ['tab', 'up', 'down', 'left', 'right'].indexOf(keyMapped)) {
					// If we're in a search field, left/right should
					// serve their usual purpose.
					if (
						e.target.classList.contains('blobselect-item-search') &&
						(('left' === keyMapped) || ('right' === keyMapped))
					) {
						return true;
					}

					e.stopPropagation();

					// Move back.
					if (('left' === keyMapped) || ('up' === keyMapped)) {
						this.traverseItems('back');
					}
					else {
						this.traverseItems('next');
					}
				}
				// Searching?
				else if (this.search && e.target.classList.contains('blobselect-item-search')) {
					this.toggleFilter();
				}
			},

			/**
			 * Toggle Filter
			 *
			 * Redraw results to take into consideration what is being
			 * searched.
			 *
			 * @returns {void} Nothing.
			 */
			toggleFilter: _debounce(function() {
				if (! this.search) {
					return;
				}

				const field = this.$el.querySelector('.blobselect-item-search');
				if (null === field) {
					return;
				}

				this.searchValue = field.textContent.replace(/\s{1,}/g, ' ').trim();
				if (-1 !== this.focus) {
					this.focus = -1;
					this.resetFocus();
				}

				let matches = {};
				let matchLabels = new Set();

				// Do a first pass to build a list of matches from the
				// raw data. This might save us DOM Mutations later.
				if (this.searchValue) {
					const items = this.niceItems;
					const itemsLength = items.length;
					const needle = RegExp(_sanitizeRegExp(this.searchValue), 'i');
					const replaceNeedle = RegExp(_sanitizeRegExp(this.searchValue), 'gi');

					for (let i = 0; i < itemsLength; ++i) {
						if (needle.test(items[i].label)) {
							matches[items[i].label] = {
								label: items[i].label,
								richLabel: _escAttr(items[i].label).replace(replaceNeedle, '<mark>$&</mark>'),
							};
							matchLabels.add(items[i].label);
						}
					}
				}

				// Now loop through HTML elements and update as needed.
				const items = this.$el.querySelectorAll('.blobselect-item');
				const itemsLength = items.length;
				const hasMatches = 0 < matchLabels.size;

				for (let i = 0; i < itemsLength; ++i) {
					// Reconstruct the label.
					const label = _parseFlat(
						JSON.parse(items[i].getAttribute('data-blob-label')) || false,
						this.niceLabelType
					);

					// It matches!
					if (matchLabels.has(label)) {
						if (! items[i].classList.contains('is-match')) {
							items[i].classList.add('is-match');
						}

						if (items[i].classList.contains('is-not-match')) {
							items[i].classList.remove('is-not-match');
						}

						items[i].innerHTML = matches[label].richLabel;
					}
					// Reset the state across the board.
					else {
						let changed = false;

						if (items[i].classList.contains('is-match')) {
							items[i].classList.remove('is-match');
							changed = true;
						}

						// We only want to tag it as a non-match if
						// there are other matches.
						if (hasMatches) {
							if (! items[i].classList.contains('is-not-match')) {
								items[i].classList.add('is-not-match');
							}
						}
						else if (items[i].classList.contains('is-not-match')) {
							items[i].classList.remove('is-not-match');
						}

						// We only need to override the label if we used
						// to match.
						if (changed) {
							items[i].textContent = label;
						}
					}
				}
			}, 150),

			/**
			 * Traverse Items
			 *
			 * This moves the focus from one item to the next.
			 *
			 * @param {string} direction Direction.
			 * @returns {void} Nothing.
			 */
			traverseItems: function(direction) {
				let newFocus = this.getItemKey(direction);

				// A change!
				if (newFocus !== this.focus) {
					// Don't forget to update the component.
					this.focus = newFocus;
					this.triggerFocus();
				}
			},

			/**
			 * Traverse Item Key
			 *
			 * Return the key corresponding to the item.
			 *
			 * @param {string} direction Direction.
			 * @returns {int} Key.
			 */
			getItemKey: function(direction) {
				// Can't do anything if there's no items.
				if (! this.minItemKey && ! this.maxItemKey) {
					return -1;
				}

				// "Current" is special. Let's check this out before
				// fiddling with any of the other types of movements.
				if ('current' === direction) {
					const field = this.$el.querySelector('.blobselect-item.is-selected');
					if (null !== field) {
						const key = parseInt(field.getAttribute('data-blob-item')) || 0;
						if (key) {
							return key;
						}
					}

					// Start over from the beginning.
					return this.getItemKey('first');
				}

				const fields = this.$el.querySelectorAll('.blobselect-item:not(.is-disabled):not(.is-not-match)');
				const fieldsLength = fields.length;
				if (! fieldsLength) {
					return -1;
				}

				// Pull all the keys; we can't trust natural sorting.
				let keys = [];
				for (let i = 0; i < fieldsLength; ++i) {
					let key = parseInt(fields[i].getAttribute('data-blob-item')) || 0;
					keys.push(key);
				}
				keys.sort(function(a, b) { return a - b; });
				const keysLength = keys.length;

				// Figure out a target.
				let start = 0;
				const min = keys[0];
				const max = keys[keysLength - 1];

				// If there is just one thing, there's just one thing.
				if (1 === keysLength) {
					return min;
				}

				switch (direction) {
				case 'next':
					start = this.focus + 1;

					if (start > max) {
						return min;
					}
					else if (start === max) {
						return max;
					}

					for (let i = 0; i < keysLength; ++i) {
						if (keys[i] >= start) {
							return keys[i];
						}
					}

					return min;
				case 'back':
					start = this.focus - 1;

					if (start < min) {
						return max;
					}
					else if (start === min) {
						return min;
					}

					for (let i = keysLength - 1; 0 <= i; --i) {
						if (keys[i] <= start) {
							return keys[i];
						}
					}

					return max;
				case 'first':
					return min;
				case 'last':
					return max;
				}

				// Last resort, -1.
				return -1;
			},

			/**
			 * Reset Focus
			 *
			 * @returns {void} Nothing.
			 */
			resetFocus: function() {
				if (0 <= this.focus) {
					let newFocus = this.search ? -1 : this.getItemKey('first');
					if (newFocus !== this.focus) {
						this.focus = newFocus;
						this.triggerFocus();
					}
				}
			},

			/**
			 * Trigger Focus
			 *
			 * @returns {void} Nothing.
			 */
			triggerFocus: function() {
				// A non-item was selected.
				if (0 > this.focus) {
					// Highlight the search field.
					if (this.search) {
						this.$el.querySelector('.blobselect-item-search').focus();
					}
				}
				else {
					// The search field is an extra monkey.
					let focusKey = this.search ? (this.focus + 1) : this.focus;
					const field = this.$el.querySelector('.blobselect-item[data-blob-item="' + focusKey + '"]');
					if (null !== field) {
						field.focus();
					}
					else {
						this.focus = -1;
						if (this.search) {
							this.$el.querySelector('.blobselect-item-search').focus();
						}
					}
				}
			},

			/**
			 * Items Click
			 *
			 * There is one click even bound to the items wrapper
			 * rather than a million bound to each item. Depending on
			 * what was clicked this may require action.
			 *
			 * @param {Event} e Event.
			 * @returns {void} Nothing.
			 */
			itemsClick: function(e) {
				// If an item was clicked directly, pass it along.
				if (e.target.classList.contains('blobselect-item')) {
					e.preventDefault();
					return this.toggleFieldSelection(e.target);
				}

				// It is possible something inside an item received the
				// event.
				let el = e.target;
				while (el.parentNode && 'classList' in el.parentNode) {
					el = el.parentNode;
					if (el.classList.contains('blobselect-item')) {
						return this.toggleFieldSelection(el);
					}
					// If we've reached blobselect we can stop.
					else if (el.classList.contains('blobselect')) {
						return;
					}
				}
			},

			/**
			 * Toggle Selection by Field
			 *
			 * @param {DOMElement} field Field.
			 * @returns {void} Nothing.
			 */
			toggleFieldSelection: function(field) {
				if (
					! field.classList.contains('blobselect-item') ||
					field.classList.contains('is-disabled')
				) {
					return;
				}

				const value = _parseFlat(
					JSON.parse(field.getAttribute('data-blob-value')) || false,
					this.niceValueType
				);

				this.toggleValueSelection(value);
			},

			/**
			 * Toggle Selection by Value
			 *
			 * @param {mixed} value Value.
			 * @returns {void} Nothing.
			 */
			toggleValueSelection: function(value) {
				value = _parseFlat(value || '', this.niceValueType);
				let changed = false;
				let tmpValue = _clone(this.value);

				// Multiple is weird.
				if (this.multiple) {
					let index = tmpValue.indexOf(value);
					// Remove it.
					if (-1 !== index) {
						tmpValue.splice(index, 1);
						changed = true;
					}
					else if (value) {
						tmpValue.push(value);
						tmpValue.sort();
						changed = true;
					}
				}
				else if (value !== tmpValue) {
					tmpValue = value;
					changed = true;
				}

				// Push the change up the line.
				if (changed) {
					this.$emit('input', tmpValue);
				}

				// Close if applicable.
				let vue = this;
				Vue.nextTick(function() {
					if (
						('open' === vue.state) &&
						(! value || vue.niceValue.has(value))
					) {
						vue.toggleState('closed');
					}
				});
			},

			/**
			 * Select First
			 *
			 * @returns {void} Nothing.
			 */
			selectFirst: function() {
				let newKey = this.getItemKey('first');
				if (0 > newKey) {
					return;
				}

				const field = this.$el.querySelector('.blobselect-item[data-blob-item="' + newKey + '"]');
				if (null === field) {
					return;
				}

				this.toggleFieldSelection(field);
			},

			/**
			 * Select Focused
			 *
			 * @returns {void} Nothing.
			 */
			selectFocused: function() {
				const field = this.$el.querySelector('.blobselect-item.is-focused');
				if (null === field) {
					return;
				}

				this.toggleFieldSelection(field);
			},
		},

		// Computed.
		computed: {
			/**
			 * Nice Name
			 *
			 * @returns {string} Name.
			 */
			niceName: function() {
				let out = this.name;

				if (! out || ('string' !== typeof out)) {
					out = 'blobselect';
				}

				if (this.multiple && ('[]' !== out.substr(-2))) {
					out += '[]';
				}

				return out;
			},

			/**
			 * Nice ID
			 *
			 * @returns {string} Name.
			 */
			niceId: function() {
				let out = this.id;

				if (! out || ('string' !== typeof out)) {
					/* eslint-disable-next-line */
					out = this.niceName.replace(/[\[\]]/g, '');
				}

				return out;
			},

			/**
			 * Processed Label Type
			 *
			 * @returns {string} Type.
			 */
			niceLabelType: function() {
				if (
					this.labelType &&
					('string' === typeof this.labelType) &&
					('num' === this.labelType.toLowerCase().substr(0, 3))
				) {
					return 'number';
				}

				// Usually it's a string.
				return 'string';
			},

			/**
			 * Processed Value Type
			 *
			 * @returns {string} Type.
			 */
			niceValueType: function() {
				if (
					this.valueType &&
					('string' === typeof this.valueType) &&
					('num' === this.valueType.toLowerCase().substr(0, 3))
				) {
					return 'number';
				}

				// Usually it's a string.
				return 'string';
			},

			/**
			 * Nice Placeholder Value
			 *
			 * @returns {mixed} Value.
			 */
			nicePlaceholderValue: function() {
				return ('string' === this.niceValueType) ? '' : 0;
			},

			/**
			 * Nice Placeholder Value
			 *
			 * @returns {mixed} Value.
			 */
			nicePlaceholderLabel: function() {
				return ('string' === this.niceLabelType) ? '' : 0;
			},

			/**
			 * Nice Value
			 *
			 * @returns {set} Value.
			 */
			niceValue: function() {
				let tmpValue;
				const values = this.itemValues;
				const valueOld = JSON.stringify(this.value);

				// Multi-selects have multiple values.
				if (this.multiple) {
					tmpValue = [];

					if (Array.isArray(this.value)) {
						for (let i = 0; i < this.value.length; ++i) {
							let tmp = _parseFlat(this.value[i], this.niceValueType);
							if (tmp && (-1 === tmpValue.indexOf(tmp)) && values.has(tmp)) {
								tmpValue.push(tmp);
							}
						}
					}

					tmpValue.sort();
				}
				// Singles don't.
				else {
					tmpValue = _parseFlat(this.value, this.niceValueType);
					if (tmpValue && ! values.has(tmpValue)) {
						tmpValue = this.nicePlaceholderValue;
					}
				}

				// Force an update if the value(s) were bad.
				if (JSON.stringify(tmpValue) !== valueOld) {
					this.$emit('input', tmpValue);
				}

				// Convert it to an array so the set is set.
				if (! this.multiple) {
					// Return an empty set if this is just placeholder.
					if (tmpValue === this.nicePlaceholderValue) {
						return new Set();
					}

					tmpValue = [tmpValue];
				}

				return new Set(tmpValue);
			},

			/**
			 * Nice Value Hash
			 *
			 * Flatten the value so we have something to watch.
			 *
			 * @returns {int} Hash.
			 */
			valueHash: function() {
				let values = Array.from(this.niceValue);
				values.sort();
				return _checksum(values);
			},

			/**
			 * Nice Items
			 *
			 * Build an authoritative list of items we can easily filter
			 * any which way elsewhere.
			 *
			 * @returns {array} Items.
			 */
			niceItems: function() {
				// Bad or missing.
				if (! Array.isArray(this.items)) {
					return [];
				}

				const itemsLength = this.items.length;
				let out = [];
				let used = new Set();

				for (let i = 0; i < itemsLength; ++i) {
					let option = {
						group: '',
						label: this.nicePlaceholderLabel,
						value: this.nicePlaceholderValue,
						disabled: this.disabled,
						placeholder: false,
					};

					// Generally an object should be passed so as to set
					// most of these values.
					if ('object' === typeof this.items[i]) {
						if (this.items[i].group) {
							option.group = _parseString(this.items[i].group);
						}
						option.label = _parseFlat(this.items[i].label, this.niceLabelType);
						option.value = _parseFlat(this.items[i].value, this.niceValueType);

						// Copy value to the label.
						if (! option.label && option.value) {
							if (this.niceLabelType !== this.niceValueType) {
								option.label = _parseFlat(option.value, this.niceLabelType);
							}
							else {
								option.label = option.value;
							}
						}

						// Maybe disable individually?
						if (! option.disabled && this.items[i].disabled) {
							option.disabled = true;
						}
					}
					// If a flat value is passed, that is both the value
					// and the label.
					else {
						option.value = _parseFlat(this.items[i], this.niceValueType);

						// Copy value to the label.
						if (option.value) {
							if (this.niceLabelType !== this.niceValueType) {
								option.label = _parseFlat(option.value, this.niceLabelType);
							}
							else {
								option.label = option.value;
							}
						}
					}

					// To be of use, it must be unique and of value.
					if (! option.value || used.has(option.value)) {
						continue;
					}
					used.add(option.value);
					out.push(option);
				}

				return out;
			},

			/**
			 * Possible Item Values
			 *
			 * @returns {set} Values.
			 */
			itemValues: function() {
				let values = this.enabledItems.map(function(v) { return v.value; });
				values.sort();
				return new Set(values);
			},

			/**
			 * Enabled Items
			 *
			 * @returns {array} Items.
			 */
			enabledItems: function() {
				return this.niceItems.filter(function(v) { return ! v.disabled; });
			},

			/**
			 * Grouped Items
			 *
			 * @returns {object|bool} Groups or false.
			 */
			groupedItems: function() {
				let items = this.niceItems.filter(function(v) { return !! v.group; });
				const itemsLength = items.length;
				if (! itemsLength) {
					return false;
				}

				let out = {};
				let used = new Set();

				// Loop it!
				for (let i = 0; i < itemsLength; ++i) {
					let group = items[i].group;
					if (! used.has(group)) {
						used.add(group);
						out[group] = [];
					}

					out[group].push(items[i]);
				}

				// Might as well sort.
				if (this.sortDirection) {
					let groupKeys = Object.keys(out);
					let groupLength = groupKeys.length;

					for (let i = 0; i < groupLength; ++i) {
						out[groupKeys[i]].sort(this.sortFunction);
					}
				}

				return out;
			},

			/**
			 * Ungrouped Items
			 *
			 * @returns {array|bool} Ungrouped items.
			 */
			ungroupedItems: function() {
				let items = this.niceItems.filter(function(v) { return ! v.group; });
				if (! items.length) {
					return false;
				}

				// Might as well sort while we're here.
				if (this.sortDirection) {
					items.sort(this.sortFunction);
				}

				return items;
			},

			/**
			 * Selected Items
			 *
			 * @returns {array} Selected items.
			 */
			selectedItems: function() {
				const values = this.niceValue;
				const vue = this;
				let items = this.enabledItems.filter(function(v) {
					return values.has(v.value);
				}).map(function(v) {
					return {
						label: v.placeholder ? vue.fieldPlaceholder : v.label,
						value: v.value,
						class: 'blobselect-selection' + (v.placeholder ? ' is-placeholder' : ''),
					};
				});

				// Might as well sort while we're here.
				if (this.sortDirection) {
					items.sort(this.sortFunction);
				}

				return items;
			},

			/**
			 * Has Selections
			 *
			 * @returns {bool} True/false.
			 */
			hasSelections: function() {
				return 0 < this.selectedItems.length;
			},

			/**
			 * Select HTML
			 *
			 * To workaround the performance limitations of v-for, we'll
			 * just generate the HTML for the <select> field manually.
			 *
			 * @returns {string} HTML.
			 */
			selectHtml: function() {
				let out = '';
				const selected = this.niceValue;

				// Add a placeholder.
				if (this.placeholder && ! this.multiple && ! this.required) {
					out += '<option value="' + (this.nicePlaceholderValue) + '">' + _escAttr(this.labelPlaceholder) + '</option>';
				}

				// Groups?
				const groups = this.groupedItems;
				if (false !== groups) {
					let groupKeys = Object.keys(this.groupedItems);
					const groupLength = groupKeys.length;
					if (this.sortDirection) {
						groupKeys.sort();
						if ('DESC' === this.sortDirection) {
							groupKeys.reverse();
						}
					}

					for (let i = 0; i < groupLength; ++i) {
						out += '<optgroup label="' + _escAttr(groupKeys[i]) + '">';

						const itemsLength = groups[groupKeys[i]].length;
						for (let j = 0; j < itemsLength; ++j) {
							out += '<option value="' + _escAttr(groups[groupKeys[i]][j].value) + '"';
							if (groups[groupKeys[i]][j].disabled) {
								out += ' disabled';
							}
							if (selected.has(groups[groupKeys[i]][j].value)) {
								out += ' selected';
							}
							out += '>' + _escAttr(groups[groupKeys[i]][j].label) + '</option>';
						}

						out += '</optgroup>';
					}
				}

				// Ungroups?
				const ungroups = this.ungroupedItems;
				if (false !== ungroups) {
					const itemsLength = ungroups.length;
					for (let i = 0; i < itemsLength; ++i) {
						out += '<option value="' + _escAttr(ungroups[i].value) + '"';
						if (ungroups[i].disabled) {
							out += ' disabled';
						}
						if (selected.has(ungroups[i].value)) {
							out += ' selected';
						}
						out += '>' + _escAttr(ungroups[i].label) + '</option>';
					}
				}

				return out;
			},

			/**
			 * Items HTML
			 *
			 * As with the above, we have to build this shit manually or
			 * else Vue will explode.
			 *
			 * @returns {string} HTML.
			 */
			itemsHtml: function() {
				let out = '';

				// Until we can v-html a <template>, we have to include
				// search field in this computed. Complicates things a
				// little. Haha.
				if (this.search) {
					out += '<div class="blobselect-item-search" type="text" contentEditable tabIndex="0"></div>';
				}

				let tabIndex = 0;

				// Add a placeholder.
				if (this.placeholder && ! this.multiple && ! this.required) {
					++tabIndex;

					let label = this.labelPlaceholder;
					let value = this.nicePlaceholderValue;
					let classes = ['blobselect-item', 'is-placeholder'];

					out += '<div class="' + classes.join(' ') + '" tabIndex="' + tabIndex + '" data-blob-item="' + tabIndex + '" data-blob-value="' + _escAttr(JSON.stringify(value)) + '" data-blob-label="' + _escAttr(JSON.stringify(label)) + '">' + _escAttr(label) + '</div>';
				}

				// Groups?
				const groups = this.groupedItems;
				if (false !== groups) {
					let groupKeys = Object.keys(this.groupedItems);
					const groupLength = groupKeys.length;
					if (this.sortDirection) {
						groupKeys.sort();
						if ('DESC' === this.sortDirection) {
							groupKeys.reverse();
						}
					}

					for (let i = 0; i < groupLength; ++i) {
						out += '<div class="blobselect-item-group">' + _escAttr(groupKeys[i]) + '</div>';

						const itemsLength = groups[groupKeys[i]].length;
						for (let j = 0; j < itemsLength; ++j) {
							++tabIndex;

							let label = groups[groupKeys[i]][j].label;
							let value = groups[groupKeys[i]][j].value;
							let classes = ['blobselect-item', 'has-group'];

							if (groups[groupKeys[i]][j].disabled) {
								classes.push('is-disabled');
							}

							if (groups[groupKeys[i]][j].placeholder) {
								classes.push('is-placeholder');
							}

							out += '<div class="' + classes.join(' ') + '" tabIndex="' + tabIndex + '"';
							out += ' data-blob-item="' + tabIndex + '"';
							out += ' data-blob-value="' + _escAttr(JSON.stringify(value)) + '" data-blob-label="' + _escAttr(JSON.stringify(label)) + '">' + _escAttr(label) + '</div>';
						}
					}
				}

				// Ungroups?
				const ungroups = this.ungroupedItems;
				if (false !== ungroups) {
					const itemsLength = ungroups.length;
					for (let i = 0; i < itemsLength; ++i) {
						++tabIndex;

						let label = ungroups[i].label;
						let value = ungroups[i].value;
						let classes = ['blobselect-item'];

						if (ungroups[i].disabled) {
							classes.push('is-disabled');
						}

						if (ungroups[i].placeholder) {
							classes.push('is-placeholder');
						}

						out += '<div class="' + classes.join(' ') + '" tabIndex="' + tabIndex + '"';
						out += ' data-blob-item="' + tabIndex + '"';
						out += ' data-blob-value="' + _escAttr(JSON.stringify(value)) + '" data-blob-label="' + _escAttr(JSON.stringify(label)) + '">' + _escAttr(label) + '</div>';
					}
				}

				if (tabIndex) {
					this.minItemKey = 1;
					this.maxItemKey = tabIndex;
				}
				else {
					this.minItemKey = 0;
					this.maxItemKey = 0;
				}

				return out;
			},

			/**
			 * Sort Direction
			 *
			 * @returns {bool|string} Direction or false.
			 */
			sortDirection: function() {
				if (! this.sort || ('string' !== typeof this.sort)) {
					return false;
				}

				if ('D' === this.sort.toUpperCase().substr(0, 1)) {
					return 'DESC';
				}

				return 'ASC';
			},

			/**
			 * Sort Function
			 *
			 * @returns {bool|function} Sort function or false.
			 */
			sortFunction: function() {
				if (false === this.sortDirection) {
					return false;
				}

				// Static functions are faster, but we have to point
				// them to the right one in a verbose way. Haha.
				switch (this.niceLabelType + this.sortDirection) {
				case 'numberASC':
					return _sortNumberASC;
				case 'numberDESC':
					return _sortNumberDESC;
				case 'stringASC':
					return _sortStringASC;
				case 'stringDESC':
					return _sortStringDESC;
				}

				// This shouldn't happen.
				return false;
			},

			/**
			 * State Class
			 *
			 * Add a class to the parent element given the state of
			 * things.
			 *
			 * @returns {string} Class.
			 */
			stateClass: function() {
				if (! this.state || ('closed' === this.state)) {
					return 'is-closed';
				}

				return 'is-' + this.state;
			},
		},

		// Watch.
		watch: {
			/**
			 * Focus Change
			 *
			 * Change the owner of the .is-focused class.
			 *
			 * @param {int} val Value.
			 * @returns {void} Nothing.
			 */
			focus: function(val) {
				// Remove existing focus classes.
				const focused = this.$el.querySelectorAll('.blobselect-item.is-focused');
				for (let i = 0; i < focused.length; ++i) {
					focused[i].classList.remove('is-focused');
				}

				// Focus an item?
				if (0 < val) {
					const field = this.$el.querySelector('.blobselect-item[data-blob-item="' + val + '"]');
					if (null !== field) {
						field.classList.add('is-focused');
					}
				}
			},

			/**
			 * Selection Change
			 *
			 * Reclass items whenever selection changes are made.
			 *
			 * @returns {void} Nothing.
			 */
			valueHash: function() {
				const values = this.niceValue;
				const valuesLength = values.size;

				// If there are no values, we can move more surgically.
				if (! valuesLength) {
					// Strip active class from non-matches.
					const active = this.$el.querySelectorAll('.blobselect-item.is-active');
					const activeLength = active.length;
					if (activeLength) {
						for (let i = 0; i < activeLength; ++i) {
							if (
								active[i].classList.contains('is-disabled') ||
								! active[i].classList.contains('is-placeholder')
							) {
								active[i].classList.remove('is-active');
							}
						}
					}

					// Make sure placeholders are enabled.
					const placeholders = this.$el.querySelectorAll('.blobselect-item.is-placeholder:not(.is-active):not(.is-disabled)');
					const placeholdersLength = placeholders.length;
					for (let i = 0; i < placeholdersLength; ++i) {
						placeholders[i].classList.add('is-active');
					}

					return;
				}

				// Unfortunately we have to loop through everything to
				// catch our intended values.
				const items = this.$el.querySelectorAll('.blobselect-item');
				const itemsLength = items.length;
				const selected = this.niceValue;
				let found = false;
				for (let i = 0; i < itemsLength; ++i) {
					// Selected!
					if (
						(! found || this.multiple) &&
						! items[i].classList.contains('is-disabled') &&
						selected.has(_parseFlat(
							JSON.parse(items[i].getAttribute('data-blob-value')) || false,
							this.niceValueType
						))
					) {
						if (! items[i].classList.contains('is-active')) {
							items[i].classList.add('is-active');
						}

						found = true;
					}
					// Shouldn't be selected.
					else if (items[i].classList.contains('is-active')) {
						items[i].classList.remove('is-active');
					}
				}
			},
		},

		template: '<div class="blobselect" v-on:keyup="toggleKeyState($event)" :tabIndex.prop="0" v-on:click.self="toggleState" :class="[ stateClass, { \'is-disabled\' : disabled, \'is-required\' : required, \'is-multiple\' : multiple }]" >\
			<div class="blobselect-selections" v-if="multiple" v-on:click.self.prevent="toggleState">\
				<div v-if="hasSelections" v-for="item in selectedItems" v-on:click.prevent="toggleValueSelection(item.value)" :class="item.class">{{ item.label }}</div>\
				<div v-if="!hasSelections && placeholder" class="blobselect-selection is-placeholder" v-on:click.prevent="toggleState">{{ fieldPlaceholder }}</div>\
			</div>\
			<div class="blobselect-selections" v-else v-on:click.prevent="toggleState">\
				<div v-if="hasSelections" v-for="item in selectedItems" :class="item.class">{{ item.label }}</div>\
				<div v-if="!hasSelections && placeholder" class="blobselect-selection is-placeholder">{{ fieldPlaceholder }}</div>\
			</div>\
			<select v-on:click.self="toggleState" :multiple="multiple" :disabled="disabled" :required="required" :name="niceName" :id="niceId" v-html="selectHtml" v-on:input="$emit(\'input\', $event.target.value)"></select>\
			</select>\
			<div class="blobselect-button" v-on:click.prevent="toggleState"></div>\
			<div class="blobselect-items" v-on:click="itemsClick($event)" v-html="itemsHtml"></div>\
		</div>',
	};



	// -----------------------------------------------------------------
	// Value Helpers
	// -----------------------------------------------------------------

	/**
	 * Parse Flat
	 *
	 * This is a fancy way of saying we want to make sure
	 * certain values are strings or numbers.
	 *
	 * @param {mixed} value Value.
	 * @param {mixed} cast Cast weird ones.
	 * @returns {mixed} Value.
	 */
	const _parseFlat = function(value, cast) {
		return ('number' === cast) ? _parseNumber(value) : _parseString(value);
	};

	/**
	 * Parse Flat: Number
	 *
	 * @param {mixed} value Value.
	 * @returns {Number} Number.
	 */
	const _parseNumber = function(value) {
		// Real simple stuff.
		if (! value || ('boolean' === typeof value)) {
			return value ? 1 : 0;
		}

		if ('number' !== typeof value) {
			try {
				value = Number(value) || 0;
			} catch (Ex) {
				value = 0;
			}
		}

		return value;
	};

	/**
	 * Parse Flat: String
	 *
	 * @param {mixed} value Value.
	 * @returns {string} String.
	 */
	const _parseString = function(value) {
		// Real simple stuff.
		if (! value || ('boolean' === typeof value)) {
			return value ? 'true' : '';
		}

		if ('string' !== typeof value) {
			try {
				value = String(value);
			} catch (Ex) {
				value = '';
			}
		}

		return value;
	};

	/**
	 * Simple Checksum
	 *
	 * The original value of each field is stored so that its change
	 * status can be detected.
	 *
	 * To make comparisons easier, and to cut down on memory waste,
	 * values are stored as a very simple checksum.
	 *
	 * @param {mixed} value Value.
	 * @returns {string} Hash.
	 */
	const _checksum = function(value) {
		// We need a string. For objects, JSON will suffice.
		if ('object' === typeof value) {
			try {
				value = JSON.stringify(value);
			} catch (Ex) {
				return 0;
			}
		}
		// For everything else, just try to cast it.
		else {
			try {
				value = value + '';
			} catch (Ex) {
				return 0;
			}
		}

		// Declare our variables.
		let hash = 0;
		const strlen = value.length;

		for (let i = 0; i < strlen; ++i) {
			let c = value.charCodeAt(i);
			hash = ((hash << 5) - hash) + c;
			hash = hash & hash; // Convert to 32-bit integer.
		}

		return hash;
	};



	// -----------------------------------------------------------------
	// Sorting
	// -----------------------------------------------------------------

	/**
	 * Sort String Asc
	 *
	 * @param {object} a First.
	 * @param {object} b Second.
	 * @return {int} Shift.
	 */
	const _sortStringASC = function(a, b) {
		// Placeholders take priority.
		if (a.placeholder === b.placeholder) {
			let a_key = a.label.toLowerCase();
			let b_key = b.label.toLowerCase();

			if (a_key === b_key) {
				return 0;
			}

			return a_key < b_key ? -1 : 1;
		}

		// Placeholders always go up.
		return a.placeholder ? -1 : 1;
	};

	/**
	 * Sort String Desc
	 *
	 * @param {object} a First.
	 * @param {object} b Second.
	 * @return {int} Shift.
	 */
	const _sortStringDESC = function(a, b) {
		// Placeholders take priority.
		if (a.placeholder === b.placeholder) {
			let a_key = a.label.toLowerCase();
			let b_key = b.label.toLowerCase();

			if (a_key === b_key) {
				return 0;
			}

			return a_key > b_key ? -1 : 1;
		}

		// Placeholders always go up.
		return a.placeholder ? -1 : 1;
	};

	/**
	 * Sort Number Asc
	 *
	 * @param {object} a First.
	 * @param {object} b Second.
	 * @return {int} Shift.
	 */
	const _sortNumberASC = function(a, b) {
		// Placeholders take priority.
		if (a.placeholder === b.placeholder) {
			let a_key = Number(a.label.replace(/[^\d.]/g, '')) || 0;
			let b_key = Number(b.label.replace(/[^\d.]/g, '')) || 0;

			if (a_key === b_key) {
				return 0;
			}

			return a_key < b_key ? -1 : 1;
		}

		// Placeholders always go up.
		return a.placeholder ? -1 : 1;
	};

	/**
	 * Sort Number Desc
	 *
	 * @param {object} a First.
	 * @param {object} b Second.
	 * @return {int} Shift.
	 */
	const _sortNumberDESC = function(a, b) {
		// Placeholders take priority.
		if (a.placeholder === b.placeholder) {
			let a_key = Number(a.label.replace(/[^\d.]/g, '')) || 0;
			let b_key = Number(b.label.replace(/[^\d.]/g, '')) || 0;

			if (a_key === b_key) {
				return 0;
			}

			return a_key > b_key ? -1 : 1;
		}

		// Placeholders always go up.
		return a.placeholder ? -1 : 1;
	};



	// -----------------------------------------------------------------
	// Misc
	// -----------------------------------------------------------------

	// This map helps make sense of keyboard-based actions.
	const keyMap = {
		8: 'backspace',
		9: 'tab',
		13: 'enter',
		27: 'escape',
		32: 'space',
		37: 'left',
		38: 'up',
		39: 'right',
		40: 'down',
	};

	/**
	 * Deep Clone
	 *
	 * Cloning complex objects can be full of pitfalls in Javascript,
	 * but for our purposes, the JSON trick works just fine.
	 *
	 * @param {mixed} src Source variable.
	 * @returns {mixed} Copy.
	 */
	const _clone = function(src) {
		if ('object' === typeof src) {
			return JSON.parse(JSON.stringify(src));
		}

		// For flat values, we can just send it back as was.
		return src;
	};

	/**
	 * Close Other Instances
	 *
	 * @param {DOMElement} el Current select.
	 * @returns {void} Nothing.
	 */
	const _closeOthers = function(el) {
		const others = document.querySelectorAll('.blobselect.is-open');
		for (let i = 0; i < others.length; ++i) {
			if (! el || el !== others[i]) {
				if ('undefined' !== typeof others[i].__vue__) {
					others[i].__vue__.toggleState('close');
				}
			}
		}
	};

	/**
	 * Cursor to End
	 *
	 * Move the cursor position to the end of a field.
	 *
	 * @param {DOMElement} el Element.
	 * @returns {void} Nothing.
	 */
	const _cursorToEnd = function(el) {
		let searchRange = document.createRange();
		let searchSelection;

		searchRange.selectNodeContents(el);
		searchRange.collapse(false);
		searchSelection = window.getSelection();
		searchSelection.removeAllRanges();
		searchSelection.addRange(searchRange);
	};

	/**
	 * Escape Attribute
	 *
	 * If for some reason an arbitrary string needs to be shoved
	 * into an HTML context, this function can be used to escape
	 * it in a similar way to the WP esc_attr() function.
	 *
	 * @param {string} attr Attribute value.
	 * @returns {string} Escaped value.
	 */
	const _escAttr = function(attr) {
		if ('string' !== typeof attr) {
			attr = _parseString(attr);
		}

		return attr
			.replace(/&/g, '&amp;')		// Handle & first.
			.replace(/'/g, '&apos;')	// Other entities.
			.replace(/"/g, '&quot;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
	};

	/**
	 * Printable Keystroke
	 *
	 * This helps differentiate between keystrokes which should add to
	 * a field's value, like the letter "a", versus others that
	 * shouldn't, like ESC.
	 *
	 * @param {int} key Key code.
	 * @returns {bool} True/false.
	 */
	const _isPrintableKey = function(key) {
		return (
			(47 < key && 58 > key) ||	// Number keys.
			(64 < key && 91 > key) ||	// Letter keys.
			(95 < key && 112 > key) ||	// Numpad keys.
			(185 < key && 193 > key) ||	// Punctuation.
			(218 < key && 223 > key)	// Brackets.
		);
	};

	/**
	 * Sanitize RegExp Characters
	 *
	 * This is used for e.g. search matching, etc., where user input
	 * might contain characters that would mess up a test.
	 *
	 * @param {string} str String.
	 * @returns {string} Sanitized string.
	 */
	const _sanitizeRegExp = function(str) {
		try {
			str = str + '';
			return str.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&');
		} catch (Ex) {
			return '';
		}
	};

	// ----------------------------------------------------------------- misc



	// -----------------------------------------------------------------
	// Click Outside
	// -----------------------------------------------------------------

	/**
	 * Click Outside
	 *
	 * Close any open <blob-select> fields if some random spot on the
	 * page is clicked.
	 *
	 * @param {event} e Event.
	 * @returns {bool} True.
	 */
	document.documentElement.addEventListener('click', function(e) {
		if ('matches' in e.target) {
			// A direct hit!
			if (e.target.matches('.blobselect')) {
				return true;
			}

			let el = e.target;
			while (el.parentNode && ('matches' in el.parentNode)) {
				el = el.parentNode;
				if (el.matches('.blobselect')) {
					return true;
				}
			}

			// This wasn't us; close them all!
			_closeOthers();
		}

		return true;
	});

	// ----------------------------------------------------------------- outside



	// -----------------------------------------------------------------
	// Connect to Vue
	// -----------------------------------------------------------------

	// Hook the code into Vue if Vue is globally exposed. If not, this
	// will require manual attachment later.
	if ('undefined' !== typeof window && window.Vue) {
		window.Vue.component('blob-select', blobSelect);
	}

	// ----------------------------------------------------------------- register
})();
