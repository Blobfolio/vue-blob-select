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
					!force ||
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
							field.innerHTML = field.textContent.replace(/\s{1,}/g, ' ').trim();
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
						!keyMapped ||
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
			},

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
				// "Current" is special. Let's check this out before
				// fiddling with any of the other types of movements.
				if ('current' === direction) {
					for (let i = 0; i < this.blobItems.length; ++i) {
						if (
							this.blobItems[i].selected &&
							!this.blobItems[i].disabled
						) {
							return i;
						}
					}

					// Start over from the beginning.
					return this.getItemKey('first');
				}

				let min = 0;
				let max = this.blobItems.length - 1;
				let change = 1;

				// We can't do anything if there are no items.
				if (0 > max) {
					return -1;
				}

				if ('next' === direction) {
					min = this.focus + 1;
					if (min > max) {
						min = 0;
					}
				}
				else if ('back' === direction) {
					min = this.focus - 1;
					max = 0;
					change = -1;

					if (0 > min) {
						return -1;
					}
				}
				else if ('last' === direction) {
					min = this.blobItems.length - 1;
					max = 0;
					change = -1;
				}

				// Count up!
				if (0 < change) {
					for (let i = min; i <= max; ++i) {
						if (
							!this.blobItems[i].disabled &&
							('blobselect-item-group' !== this.blobItems[i].class) &&
							(-1 === this.blobItems[i].class.indexOf('is-not-match'))
						) {
							return i;
						}
					}

					// Try again from the beginning?
					if ('next' === direction) {
						return this.getItemKey('first');
					}

					return -1;
				}

				for (let i = min; max <= i; --i) {
					if (
						!this.blobItems[i].disabled &&
						('blobselect-item-group' !== this.blobItems[i].class) &&
						(-1 === this.blobItems[i].class.indexOf('is-not-match'))
					) {
						return i;
					}
				}

				// Try again from the end?
				if (!this.search && ('back' === direction)) {
					return this.getItemKey('last');
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
					try {
						this.$el.querySelector('.blobselect-items').children[focusKey].focus();
					} catch (Ex) {
						console.warn('DOM mutations prevented focus from being transferred.');
					}
				}
			},

			/**
			 * Toggle Selection
			 *
			 * @param {mixed} value Value.
			 * @returns {void} Nothing.
			 */
			toggleSelection: function(value) {
				value = _parseFlat(value, this.niceValueType);

				let tmpValue = _clone(this.value);
				let changed = false;

				// Multiple is weird.
				if (this.multiple) {
					let index = tmpValue.indexOf(value);
					// Remove the value if it already selected.
					if (-1 !== index) {
						tmpValue.splice(index, 1);
						changed = true;
					}
					// Add it if we can.
					else if (-1 !== this.niceValues.indexOf(value)) {
						tmpValue.push(value);
						tmpValue.sort();
						changed = true;
					}

					// We don't need placeholders selected any more.
					if (1 < tmpValue.length) {
						let length = tmpValue.length;
						tmpValue = tmpValue.filter(Boolean);
						if (length !== tmpValue.length) {
							changed = true;
						}
					}
				}
				else if (
					(value !== tmpValue) &&
					(-1 !== this.niceValues.indexOf(value))
				) {
					tmpValue = value;
					changed = true;
				}

				// Push the change up the line.
				if (changed) {
					this.$emit('input', tmpValue);
				}

				// Close if applicable.
				if (
					('open' === this.state) &&
					(-1 !== this.niceValues.indexOf(value))
				) {
					this.toggleState('closed');
				}
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

				let newValue = this.blobItems[newKey].value;
				let tmpValue = _clone(this.value);
				let changed = false;
				if (this.multiple && (-1 === tmpValue.indexOf(newValue))) {
					tmpValue.push(newValue);
					tmpValue.sort();
					changed = true;
				}
				else if (!this.multiple && (newValue !== tmpValue)) {
					tmpValue = newValue;
					changed = true;
				}

				if (changed) {
					this.$emit('input', tmpValue);
				}

				// Close if applicable.
				if ('open' === this.state) {
					this.toggleState('closed');
				}
			},

			/**
			 * Select Focused
			 *
			 * @returns {void} Nothing.
			 */
			selectFocused: function() {
				// If nothing is focused, select the first.
				if (0 > this.focus || this.focus >= this.blobItems.length) {
					this.selectFirst();
					return;
				}

				// If it is disabled, do nothing.
				if (this.blobItems[this.focus].disabled) {
					return;
				}

				let tmpValue = _clone(this.value);
				let newValue = this.blobItems[this.focus].value;

				let changed = false;
				if (this.multiple && (-1 === tmpValue.indexOf(newValue))) {
					tmpValue.push(newValue);
					tmpValue.sort();
					changed = true;
				}
				else if (!this.multiple && (newValue !== tmpValue)) {
					tmpValue = newValue;
					changed = true;
				}

				if (changed) {
					this.$emit('input', tmpValue);
				}

				// Close if applicable.
				if ('open' === this.state) {
					this.toggleState('closed');
				}
			},

			/**
			 * Toggle Filter
			 *
			 * Run a search.
			 *
			 * @param {string} value Content.
			 * @returns {void} Nothing.
			 */
			toggleFilter: function(value) {
				this.searchValue = value.replace(/\s{1,}/g, ' ').trim();
				this.resetFocus();
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

				if (!out || ('string' !== typeof out)) {
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

				if (!out || ('string' !== typeof out)) {
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
			 * Nice Value
			 *
			 * Returns the value as an array containing correctly-cast
			 * values.
			 *
			 * These values may not actually exist among the items; that
			 * determination is handled elsewhere.
			 *
			 * @returns {array} Value.
			 */
			niceValue: function() {
				let out = [];

				// We only want to dive into this if we've initialized.
				if (this.init) {
					if (this.multiple && Array.isArray(this.value)) {
						for (let i = 0; i < this.value.length; ++i) {
							let tmp = _parseFlat(this.value[i], this.niceValueType);
							if (tmp && (-1 === out.indexOf(tmp))) {
								out.push(tmp);
							}
						}
						out.sort();
					}
					else if (!this.multiple && this.value) {
						let tmp = _parseFlat(this.value, this.niceValueType);
						if (tmp) {
							out.push(tmp);
						}
					}
				}

				return out;
			},

			/**
			 * Nice Values
			 *
			 * All possible item values.
			 *
			 * @returns {array} Values.
			 */
			niceValues: function() {
				let out = [];

				for (let i = 0; i < this.niceItems.length; ++i) {
					if (!this.niceItems[i].disabled) {
						out.push(this.niceItems[i].value);
					}
				}

				out.sort();
				return out;
			},

			/**
			 * Processed Items
			 *
			 * This function is a bastard, but basically exists to
			 * crunch inconsistent user data into a predictable format.
			 * More specialized computeds can reference this instead.
			 *
			 * @returns {Array} Items.
			 */
			niceItems: function() {
				// As we go, this is the list to be returned.
				let out = [];

				// Bad or missing.
				if (!Array.isArray(this.items) || !this.items.length) {
					return out;
				}

				// Data might be tiered.
				let groups = {};
				let groupKeys = [];

				// Keep track of what we find as we go along.
				let usedValues = {};
				let hasGrouped = false;
				let hasUngrouped = false;
				let hasSelected = false;

				// First pass, run through the provided options.
				for (let i = 0; i < this.items.length; ++i) {
					let option = {
						group: '',
						label: ('string' === this.niceLabelType) ? '' : 0,
						value: ('string' === this.niceValueType) ? '' : 0,
						disabled: this.disabled,
						placeholder: false,
						selected: false,
					};

					// Generally an object should be passed so as to set
					// most of these values.
					if ('object' === typeof this.items[i]) {
						option.group = _parseString(this.items[i].group);
						option.label = _parseFlat(this.items[i].label, this.niceLabelType);
						option.value = _parseFlat(this.items[i].value, this.niceValueType);

						// Copy value to the label.
						if (!option.label && option.value) {
							option.label = _parseFlat(this.items[i].value, this.labelType);
						}

						// Maybe disable individually?
						if (!option.disabled && this.items[i].disabled) {
							option.disabled = true;
						}
					}
					// If a flat value is passed, that is both the value
					// and the label.
					else {
						option.value = _parseFlat(this.items[i], this.niceValueType);

						// Copy value to the label.
						if (option.value) {
							option.label = _parseFlat(this.items[i], this.labelType);
						}
					}

					// To be of use, it must be unique and of value.
					if (!option.value || usedValues[option.value]) {
						continue;
					}
					usedValues[option.value] = true;

					// Mark it as selected if it is selected.
					if (
						!option.disabled &&
						this.init &&
						(!hasSelected || this.multiple) &&
						(-1 !== this.niceValue.indexOf(option.value))
					) {
						option.selected = true;
						hasSelected = true;
					}

					// We need to split grouped and ungrouped items for
					// sorting purposes. If it's a group, add it thusly.
					if (option.group) {
						if ('undefined' === typeof groups[option.group]) {
							groups[option.group] = [];
							groupKeys.push(option.group);
							hasGrouped = true;
						}

						groups[option.group].push(option);
					}
					// Otherwise add it to the ungrouped stack.
					else {
						hasUngrouped = true;
						out.push(option);
					}
				}

				// Sort our group keys real quick, if applicable.
				if (1 < groupKeys.length && this.sortDirection) {
					groupKeys.sort();
					if ('DESC' === this.sortDirection) {
						groupKeys.reverse();
					}
				}

				// Now is a good time to add a placeholder if
				// applicable.
				if (this.placeholder && !this.required) {
					let option = {
						group: '',
						label: this.labelPlaceholder,
						value: ('string' === this.niceValueType) ? '' : 0,
						disabled: this.disabled,
						placeholder: true,
						selected: false,
					};

					// If there are any ungrouped values, add the
					// placeholder to that.
					if (hasUngrouped || !hasGrouped) {
						out.unshift(option);
					}
					else {
						option.group = groupKeys[0];
						groups[groupKeys[0]].unshift(option);
					}
				}

				// If sorting, let's sort and add all at once. This adds
				// redundant code but prevents redundant operations.
				if (this.sortDirection) {
					// Sort ungrouped entries first.
					if (1 < out.length) {
						out.sort(this.sortFunction);
					}

					// Now sort each group and add them to the list.
					if (groupKeys.length) {
						// This runs backwards because we are shifting
						// groups to the top.
						for (let i = groupKeys.length - 1; 0 <= i; --i) {
							// Sort within the group first.
							if (1 < groups[groupKeys[i]].length) {
								groups[groupKeys[i]].sort(this.sortFunction);
							}

							// Add each group item to the top of out.
							for (let j = groups[groupKeys[i]].length - 1; 0 <= j; --j) {
								out.unshift(groups[groupKeys[i]][j]);
							}
						}
					}
				}
				// If we aren't sorting, just merge them directly.
				else if (groupKeys.length) {
					// This runs backwards because we are shifting
					// groups to the top.
					for (let i = groupKeys.length - 1; 0 <= i; --i) {
						// Add each group item to the top of out.
						for (let j = groups[groupKeys[i]].length - 1; 0 <= j; --j) {
							out.unshift(groups[groupKeys[i]][j]);
						}
					}
				}

				// If there are no items, we're basically done.
				if (!out.length) {
					// Quickie init.
					if (!this.init) {
						let tmpValue;

						if (this.multiple) {
							tmpValue = [];
						}
						else if ('string' === this.niceValueType) {
							tmpValue = '';
						}
						else {
							tmpValue = 0;
						}

						this.init = true;
						this.$emit('input', tmpValue);
					}

					return out;
				}

				// We need to do a special state sync on first load
				// because the item(s) and value(s) may not jive.
				if (!this.init) {
					let tmpValue = _clone(this.value);

					// First, let's clean up the user-supplied value(s).
					if (this.multiple) {
						if (!Array.isArray(tmpValue)) {
							tmpValue = [];
						}
						else {
							let tmp = [];

							// Make sure the values are of the right
							// type, and present.
							for (let i = 0; i < tmpValue.length; ++i) {
								let value = _parseFlat(tmpValue[i], this.niceValueType);
								if (
									value &&
									usedValues[value] &&
									(-1 === tmp.indexOf(value))
								) {
									tmp.push(value);
								}
							}
							tmpValue = tmp;
						}
					}
					// Single values are easier.
					else {
						tmpValue = _parseFlat(tmpValue, this.niceValueType);

						// Update selections before we return items.
						if (!tmpValue || !usedValues[tmpValue]) {
							tmpValue = ('string' === this.niceValueType) ? '' : 0;
						}
					}

					// Second pass, let's select any selectable items,
					// and void any unselectable values.
					if (
						(this.multiple && tmpValue.length) ||
						(!this.multiple && tmpValue)
					) {
						let foundValues = [];
						for (let i = 0; i < out.length; ++i) {
							if (this.multiple) {
								if (-1 !== tmpValue.indexOf(out[i].value)) {
									// Void the value; it can't be
									// selected.
									if (out[i].disabled) {
										tmpValue.splice(tmpValue.indexOf(out[i].value), 1);
									}
									else {
										foundValues.push(out[i].value);
										out[i].selected = true;
									}

									// If we have found everything,
									// we're done!
									if (tmpValue.length === foundValues.length) {
										break;
									}
								}
							}
							else if (tmpValue === out[i].value) {
								// Void the value; it can't be selected.
								if (out[i].disabled) {
									tmpValue = ('string' === this.niceValueType) ? '' : 0;
								}
								// Select the value.
								else {
									foundValues.push(out[i].value);
									out[i].selected = true;
								}

								// One and done!
								break;
							}
						}

						// Make sure we found everything.
						if (this.multiple) {
							if (foundValues.length !== tmpValue.length) {
								tmpValue = foundValues;
								tmpValue.sort();
							}
						}
						else {
							if (tmpValue && !foundValues.length) {
								tmpValue = ('string' === this.niceValueType) ? '' : 0;
							}
						}
					}

					// One final pass: select placeholder.
					if (!tmpValue && this.placeholder && !this.required) {
						for (let i = 0; i < out.length; ++i) {
							if (out[i].placeholder) {
								out[i].selected = true;
								break;
							}
						}
					}

					// Finally, mark this as ready!
					this.init = true;
					this.$emit('input', tmpValue);
				}

				return out;
			},

			/**
			 * Items for blobSelect
			 *
			 * @returns {Array} Items.
			 */
			blobItems: function() {
				let out = [];

				// Keep track of group labels and whatnot.
				let lastGroup = '';
				let tabIndex = 0;

				// Filtering might apply here.
				const doingSearch = this.search && this.searchValue;
				const needle = doingSearch ? RegExp(_sanitizeRegExp(this.searchValue), 'i') : '';
				const replaceNeedle = doingSearch ? RegExp(_sanitizeRegExp(this.searchValue), 'gi') : '';
				let matches = 0;

				for (let i = 0; i < this.niceItems.length; ++i) {
					// Increase our tab index.
					++tabIndex;

					// Inject a group label.
					if (
						this.niceItems[i].group &&
						(lastGroup !== this.niceItems[i].group)
					) {
						lastGroup = this.niceItems[i].group;
						out.push({
							class: 'blobselect-item-group',
							disabled: false,
							label: this.niceItems[i].group,
							richLabel: this.niceItems[i].group,
							placeholder: false,
							selected: false,
							tabIndex: tabIndex,
							value: false,
						});

						// Increase our tab index.
						++tabIndex;
					}

					// We might need to rich-up the label.
					let richLabel = this.niceItems[i].label;

					// What classes belong here?
					let classes = ['blobselect-item'];
					if (this.niceItems[i].group) {
						classes.push('has-group');
					}
					if (this.niceItems[i].disabled) {
						classes.push('is-disabled');
					}
					if (this.niceItems[i].placeholder) {
						classes.push('is-placeholder');
					}
					if (this.niceItems[i].selected) {
						classes.push('is-active');
					}
					if (doingSearch) {
						if (needle.test(this.niceItems[i].label)) {
							classes.push('is-match');
							richLabel = richLabel.replace(replaceNeedle, '<mark>$&</mark>');
							++matches;
						}
						else {
							classes.push('is-not-match');
						}
					}

					out.push({
						class: classes.join(' '),
						disabled: this.niceItems[i].disabled,
						label: this.niceItems[i].label,
						richLabel: richLabel,
						placeholder: this.niceItems[i].placeholder,
						selected: this.niceItems[i].selected,
						tabIndex: this.niceItems[i].label,
						value: this.niceItems[i].value,
					});
				}

				// If we're filtering and no matches were found, we need
				// to bring it all back. Haha.
				if (doingSearch && !matches) {
					for (let i = 0; i < out.length; ++i) {
						out[i].class = out[i].class.replace(' is-not-match', '');
					}
				}

				return out;
			},

			/**
			 * Items for real select.
			 *
			 * Since none of these <options> are themselves reactive, we
			 * can gain some performance by dumping a string for use
			 * with v-html rather than pushing them with a v-for.
			 *
			 * @returns {string} HTML.
			 */
			selectItems: function() {
				let out = '';

				// Keep track of group labels and whatnot.
				let lastGroup = '';

				for (let i = 0; i < this.niceItems.length; ++i) {
					// Working in a group.
					if (
						this.niceItems[i].group &&
						(this.niceItems[i].group !== lastGroup)
					) {
						// Close out the previous group.
						if (lastGroup) {
							out += '</optgroup>';
						}

						// Start the new group.
						out += '<optgroup label="' + _escAttr(this.niceItems[i].group) + '">';
						lastGroup = this.niceItems[i].group;
					}
					// Moving to a non-group.
					else if (lastGroup) {
						out += '</optgroup>';
						lastGroup = '';
					}

					// Build an option for it.
					let option = '<option value="' + _escAttr(this.niceItems[i].value) + '"';
					if (this.niceItems[i].disabled) {
						option += ' disabled';
					}
					else if (this.niceItems[i].selected) {
						option += ' selected';
					}
					option += '>' + _escAttr(this.niceItems[i].label) + '</option>';

					// And add it to our output.
					out += option;
				}

				// Close any dangling groups.
				if (lastGroup) {
					out += '</optgroup>';
				}

				return out;
			},

			/**
			 * Selected Items
			 *
			 * @returns {array} Items.
			 */
			selectedItems: function() {
				let out = [];

				for (let i = 0; i < this.niceItems.length; ++i) {
					if (
						this.niceItems[i].selected &&
						!this.niceItems[i].disabled
					) {
						out.push({
							label: this.niceItems[i].placeholder ? this.fieldPlaceholder : this.niceItems[i].label,
							value: this.niceItems[i].value,
							class: 'blobselect-selection' + (this.niceItems[i].placeholder ? ' is-placeholder' : ''),
						});
					}
				}

				return out;
			},

			/**
			 * Sort Direction
			 *
			 * @returns {bool|string} Direction or false.
			 */
			sortDirection: function() {
				if (!this.sort || ('string' !== typeof this.sort)) {
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
				if (!this.state || ('closed' === this.state)) {
					return 'is-closed';
				}

				return 'is-' + this.state;
			},
		},

		template: '<div class="blobselect" v-on:keyup="toggleKeyState($event)" :tabIndex.prop="0" v-on:click.self="toggleState" :class="[ stateClass, { \'is-disabled\' : disabled, \'is-required\' : required, \'is-multiple\' : multiple }]" >\
			<div class="blobselect-selections" v-if="multiple" v-on:click.self.prevent="toggleState">\
				<div v-if="selectedItems.length" v-for="item in selectedItems" v-on:click.prevent="toggleSelection(item.value)" :class="item.class">{{ item.label }}</div>\
				<div v-if="!selectedItems.length && placeholder" class="blobselect-selection is-placeholder" v-on:click.prevent="toggleState">{{ fieldPlaceholder }}</div>\
			</div>\
			<div class="blobselect-selections" v-else v-on:click.prevent="toggleState">\
				<div v-if="selectedItems.length" v-for="item in selectedItems" :class="item.class">{{ item.label }}</div>\
				<div v-if="!selectedItems.length && placeholder" class="blobselect-selection is-placeholder">{{ fieldPlaceholder }}</div>\
			</div>\
			<select v-on:click.self="toggleState" :multiple="multiple" :disabled="disabled" :required="required" :name="niceName" :id="niceId" v-html="selectItems" v-on:input="$emit(\'input\', $event.target.value)"></select>\
			</select>\
			<div class="blobselect-button" v-on:click.prevent="toggleState"></div>\
			<div class="blobselect-items">\
				<div v-if="search" class="blobselect-item-search" type="text" contentEditable v-on:input="toggleFilter($event.target.textContent)" v-on:click="resetFocus" tabIndex="0"></div>\
				<div v-for="(item, index) in blobItems" :class="[item.class, { \'is-focused\' : index === focus }]" :tabIndex.prop="item.tabIndex" v-on:click.prevent="toggleSelection(item.value)" v-html="item.richLabel"></div>\
			</div>\
		</div>',
	};

	// ----------------------------------------------------------------- end component



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
		if (!value || ('boolean' === typeof value)) {
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
		if (!value || ('boolean' === typeof value)) {
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

	// ----------------------------------------------------------------- end values



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

			return a_key > b_key ? -1 : 1;
		}

		// Placeholders always go up.
		return a.placeholder ? -1 : 1;
	};

	// ----------------------------------------------------------------- sorting



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
			if (!el || el !== others[i]) {
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
