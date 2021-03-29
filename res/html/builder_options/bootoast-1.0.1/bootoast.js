/**
 * AMD adapter!
 * 
 * @see https://github.com/umdjs/umd
 * 
 * @author Luiz Machado <https://github.com/odahcam>
 */
(function (root, factory) {

	if (typeof define === 'function' && define.amd) {

		// AMD. Register as an anonymous module.
		define(['exports', 'jquery'], function (exports, jquery) {
			factory((root.bootoast = exports), jquery);
		});

	} else if (typeof exports === 'object' && typeof exports.nodeName !== 'string') {

		// CommonJS
		factory(exports, require('jquery'));

	} else {

		// Browser globals
		factory((root.bootoast = {}), root.jQuery);

	}

}(this, function (exports, $) {
	// Use bootoast, bootbox in some fashion.

	'use strict';

	if (!$) {
		console.error('jQuery não encontrado, seu plugin jQuery não irá funcionar.');
		return false;
	}

	/**
	 * Store the plugin name in a variable. It helps you if later decide to change the plugin's name
	 * @var {string} pluginName
	 */
	var pluginName = 'bootoast';

	/**
	 * The plugin constructor.
	 */
	function Bootoast(options) {

		if (typeof options === 'string') {
			options = {
				message: options
			};
		}

		if (typeof options !== 'object') return;

		// define as opções interpretadas
		this.settings = $.extend({}, this.defaults, options);
		// define o conteúdo
		this.content = this.settings.content || this.settings.text || this.settings.message;
		// define o elemento de progress como nulo
		this.timeoutProgress = null;
		// define uma posição aceitável pro elemento
		this.position = this.positionFor(this.settings.position).split('-');
		// Define o .glyphicon com base no .alert-<type>
		this.settings.icon = this.settings.icon || this.icons[this.settings.type];

		var containerClass = pluginName + '-container';

		this.containerSelector = '.' + containerClass + '.' + this.position.join('.');

		// Checa se já tem container, se não cria um.
		if ($('body > ' + this.containerSelector).length === 0) {
			$('<div>', {
				class: containerClass + ' ' + this.position.join(' ')
			}).appendTo('body');
		}

		// Adiciona o .alert ao .container conforme seu posicionamento.
		this.$el = $('<div class="' + pluginName + ' alert alert-' + this.typeFor(this.settings.type) + '"><i class="bi bi-' + this.settings.icon + '"></i><span class="bootoast-alert-container"><span class="bootoast-alert-content">' + this.content + '</span></span></div>');

		this.init();
	}

	$.extend(Bootoast.prototype, {
		/**
		 * Default options
		 *
		 * @var {Object} defaults
		 */
		defaults: {
			/**
			 * Any HTML string.
			 * @var {string}
			 */
			message: 'Bootoast!',
			/**
			 * ['warning', 'success', 'danger', 'info']
			 * @var {string}
			 */
			type: 'info',
			/**
			 * ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right']
			 * @var {string}
			 */
			position: 'bottom-center',
			/**
			 * @var {string}
			 */
			icon: null,
			/**
			 * Seconds, use null to disable timeout hiding.
			 * @var {int}
			 */
			timeout: 3,
			/** 
			 * [false, 'top', 'bottom', 'background']
			 * 
			 * @var {string|bool}
			 */
			timeoutProgress: false,
			/**
			 * Animation duration in miliseconds.
			 * 
			 * @var {int}
			 */
			animationDuration: 300,
			/**
			 * @var {bool}
			 */
			dismissible: true,
		},
		/**
		 * Default icons
		 *
		 * @var {Object} icons
		 */
		icons: {
			warning: 'exclamation',
			success: 'check2',
			danger: 'x',
			info: 'info'
		},
		/**
		 * Types
		 *
		 * @var {Object} types
		 */
		types: [
			'primary',
			'secondary',
			'info',
			'success',
			'warning',
			'danger'
		],
		/**
		 * Type Sinonymus
		 *
		 * @var {Object} typeSinonym
		 */
		typeSinonym: {
			warn: 'warning',
			error: 'danger',
		},
		/**
		 * Position Supported
		 *
		 * @var {array} positions
		 */
		positions: [
			'top-left',
			'top-center',
			'top-right',
			'bottom-left',
			'bottom-center',
			'bottom-right'
		],
		/**
		 * Position Sinonymus
		 *
		 * @var {Object} positionSinonym
		 */
		positionSinonym: {
			bottom: 'bottom-center',
			leftBottom: 'bottom-left',
			rightBottom: 'bottom-right',
			top: 'top-center',
			rightTop: 'top-right',
			leftTop: 'top-left'
		},
		/**
		 * Initializes the plugin functionality
		 */
		init: function () {

			// Define se o novo .alert deve ser inserido por primeiro ou último no container.
			this.$el[(this.position[0] === 'bottom' ? 'append' : 'prepend') + 'To'](this.containerSelector);

			var plugin = this;

			if (this.settings.dismissible === true) {
				this.$el
					.addClass('alert-dismissible')
					.prepend('<button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>')
					.on('click', 'button.close', function (e) {
						e.preventDefault();
						plugin.hide();
					});
			}

			// Exibe o .alert
			this.$el.animate({
				opacity: 1,
			}, this.settings.animationDuration);

			// Se o .alert tem tempo de expiração
			if (this.settings.timeout) {

				var secondsTimeout = parseInt(this.settings.timeout * 1000);

				this.hide(secondsTimeout);
			}
		},
		/**
		 * @method hide
		 *
		 * @param {int} timeout
		 *
		 * @return {int} The setTimeout ID.
		 */
		hide: function (timeout) {
			var plugin = this;

			if (this.settings.timeoutProgress) {
				this.setTimeoutProgress(this.settings.timeoutProgress);
			}

			var timerId = setTimeout(function () {
				plugin.$el.animate({
					opacity: 0,
				}, plugin.settings.animationDuration, function () {
					plugin.$el.remove();
				});
			}, timeout || 0);

			// Pausa o timeout baseado no hover
			this.$el.hover(
				clearTimeout.bind(window, timerId),
				function () {
					timerId = plugin.hide(timeout);
				}
			);

			return timerId;
		},
		/**
		 * @param {string} progressPosition
		 * 
		 * @return {number}
		 */
		setTimeoutProgress: function (progressPosition) {

			if (this.timeoutProgress !== null) {
				this.timeoutProgress.remove();
			}

			var positionOptions = {
				top: 'prepend',
				bottom: 'append',
			};

			var $progress = $('<div>', {
				class: 'progress',
				html: $('<div>', {
					class: 'progress-bar progress-bar-striped active',
					role: 'progressbar',
					'aria-valuemin': 0,
					'aria-valuenow': 0,
					'aria-valuemax': 100,
				})
			});

			var putMethod = positionOptions[progressPosition] || 'append';
			var position = typeof positionOptions[progressPosition] === 'string' ? progressPosition : 'background';

			this.timeoutProgress = $progress.addClass('progress-' + position)[putMethod + 'To'](this.$el)

			return this.timeoutProgress;
		},
		/**
		 * @param {string} type
		 *
		 * @return {string} Gets the correct type-name for the given value or null.
		 */
		typeFor: function (type) {

			// se esta type é padrão
			if (this.types[type]) {
				return type;
			}

			if (!type) {
				return 'default';
			}

			var sinonym = this.typeSinonym[type];

			return sinonym || type;
		},
		/**
		 * @param {string} position
		 *
		 * @return {string} The correct position-name for the given value or ''.
		 */
		positionFor: function (position) {

			// se esta posição é padrão
			if (this.positions[position]) return position;

			var positionCamel = $.camelCase(position);

			// Tenta encontrar um sinônimo
			return this.positionSinonym[positionCamel] || 'bottom-center';
		},

		/**
		 *
		 * @param {HTMLElement} elem
		 * @param {int} qty
		 * 
		 * @return {int} The interval ID, so you can cancel the movement bro.
		 */
		moveProgressbar: function(elem, qty) {

			var that = this;
			var width = 100;
			
			var id = setInterval(function () {
				if (width <= 0) {
					clearInterval(id);
				} else {
					width--;
					elem.style.width = width + '%';
				}
			}, 100 / qty);

			return id;
		}
	});

	// attach properties to the exports object to define
	// the exported module properties.
	exports.toast = function (options) {
		return new Bootoast(options);
	};

	return exports;
}));