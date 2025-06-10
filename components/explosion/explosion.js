// components/explosion/explosion.js
Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    position: {
      type: Number,
      value: -1
    },
    result: {
      type: String,
      value: 'win' // win, lose
    }
  },

  data: {
    
  },

  methods: {
    onTap() {
      this.triggerEvent('close')
    }
  }
})
