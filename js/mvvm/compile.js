function Compile(el, vm) {
  // 保存vm
  this.$vm = vm;
  // 保存el元素
  this.$el = this.isElementNode(el) ? el : document.querySelector(el);
  if (this.$el) {
    // 1. 将el中所有了子节点转移到fragment对象中, 并保存fragment
    this.$fragment = this.node2Fragment(this.$el);
    // 2. 编译fragment中所有层次子节点
    this.init();
    // 3. 将编译好的fragment添加到el中显示
    this.$el.appendChild(this.$fragment);
  }
}

Compile.prototype = {
  node2Fragment: function (el) {
    var fragment = document.createDocumentFragment(),
      child;

    // 将原生节点拷贝到fragment
    while (child = el.firstChild) {
      fragment.appendChild(child);
    }

    return fragment;
  },

  init: function () {
    this.compileElement(this.$fragment);
  },

  /*
  编译指定元素/fragment的所有层次子节点(利用递归调用)
   */
  compileElement: function (el) {
    // 得到所有子节点
    var childNodes = el.childNodes,
      me = this;
    // 遍历所有子节点
    [].slice.call(childNodes).forEach(function (node) { // 某个子节点
      // 得到节点的文本内容
      var text = node.textContent;
      // 用于匹配大括号表达式的正则对象
      var reg = /\{\{(.*)\}\}/;
      // 如果是一个元素节点
      if (me.isElementNode(node)) {
        // 编译元素节点中的指令属性
        me.compile(node);
        // 如果是大括号表达式格式的文本节点
      } else if (me.isTextNode(node) && reg.test(text)) {
        // 编译大括号表达式
        me.compileText(node, RegExp.$1);
      }
      // 如果当前子节点还有子节点
      if (node.childNodes && node.childNodes.length) {
        // 递归用调实现所有层次节点的编译
        me.compileElement(node);
      }
    });
  },

  compile: function (node) {
    var nodeAttrs = node.attributes,
      me = this;

    [].slice.call(nodeAttrs).forEach(function (attr) {
      var attrName = attr.name;
      if (me.isDirective(attrName)) {
        var exp = attr.value;
        var dir = attrName.substring(2);
        // 事件指令
        if (me.isEventDirective(dir)) {
          compileUtil.eventHandler(node, me.$vm, exp, dir);
          // 普通指令
        } else {
          compileUtil[dir] && compileUtil[dir](node, me.$vm, exp);
        }

        node.removeAttribute(attrName);
      }
    });
  },

  compileText: function (node, exp) {
    compileUtil.text(node, this.$vm, exp);
  },

  isDirective: function (attr) {
    return attr.indexOf('v-') == 0;
  },

  isEventDirective: function (dir) {
    return dir.indexOf('on') === 0;
  },

  isElementNode: function (node) {
    return node.nodeType == 1;
  },

  isTextNode: function (node) {
    return node.nodeType == 3;
  }
};

// 包含n个解析指令/大括号表达的函数的工具对象
var compileUtil = {
  // 解析v-text/大括号表达式
  text: function (node, vm, exp) {
    this.bind(node, vm, exp, 'text');
  },

  html: function (node, vm, exp) {
    this.bind(node, vm, exp, 'html');
  },

  model: function (node, vm, exp) {
    this.bind(node, vm, exp, 'model');

    var me = this,
      val = this._getVMVal(vm, exp);
    node.addEventListener('input', function (e) {
      var newValue = e.target.value;
      if (val === newValue) {
        return;
      }

      me._setVMVal(vm, exp, newValue);
      val = newValue;
    });
  },

  class: function (node, vm, exp) {
    this.bind(node, vm, exp, 'class');
  },

  // 调用对应的节点更新函数去更新节点
  bind: function (node, vm, exp, dir) {
    // 根据指令名得到对应的节点更新函数
    var updaterFn = updater[dir + 'Updater'];
    // 执行更新函数更新节点
    updaterFn && updaterFn(node, this._getVMVal(vm, exp));

    new Watcher(vm, exp, function (value, oldValue) {
      updaterFn && updaterFn(node, value, oldValue);
    });
  },

  // 事件处理
  eventHandler: function (node, vm, exp, dir) {
    var eventType = dir.split(':')[1],
      fn = vm.$options.methods && vm.$options.methods[exp];

    if (eventType && fn) {
      node.addEventListener(eventType, fn.bind(vm), false);
    }
  },

  // 得到表达式对应的属性值
  _getVMVal: function (vm, exp) {
    var val = vm._data;
    exp = exp.split('.');
    exp.forEach(function (k) {
      val = val[k];
    });
    return val;
  },

  // 设置表达式所对应的属性的值
  _setVMVal: function (vm, exp, value) {
    var val = vm._data;
    exp = exp.split('.');
    exp.forEach(function (k, i) {
      // 非最后一个key，更新val的值
      if (i < exp.length - 1) {
        val = val[k];
      } else {
        val[k] = value;
      }
    });
  }
};


// 包含n个更新节点的方法的对象
var updater = {
  // 更新节点的textContent属性
  textUpdater: function (node, value) {
    node.textContent = typeof value == 'undefined' ? '' : value;
  },

  // 更新节点的inner属性
  htmlUpdater: function (node, value) {
    node.innerHTML = typeof value == 'undefined' ? '' : value;
  },

  // 更新节点的className属性
  classUpdater: function (node, value, oldValue) {
    var className = node.className;
    className = className.replace(oldValue, '').replace(/\s$/, '');

    var space = className && String(value) ? ' ' : '';

    node.className = className + space + value;
  },

  // 更新节点的value属性
  modelUpdater: function (node, value, oldValue) {
    node.value = typeof value == 'undefined' ? '' : value;
  }
};