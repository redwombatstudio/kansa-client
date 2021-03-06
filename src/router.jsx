import PropTypes from 'prop-types'
import React from 'react'
import { IndexRedirect, IndexRoute, Redirect, Route, Router } from 'react-router'

import { keyLogin, tryLogin } from './app/actions/auth'
import { HUGO_ADMIN_ROUTE_ROOT } from './hugo-admin/constants'

import App from './app/components/App'
import Index from './app/components/Index'
import Nominate from './hugo-nominations/components/Nominate'
import Vote from './hugo-votes'
import NewDaypassForm from './membership/components/NewDaypassForm'
import NewMemberForm from './membership/components/NewMemberForm'
import NewMemberIndex from './membership/components/NewMemberIndex'
import Upgrade from './membership/components/Upgrade'
import Payments from './payments'
import NewPayment from './payments/new-payment'

const hugoRoutes = (path, requireAuth) => (
  <Route path={path} >
    <IndexRedirect to='vote' />
    <Route path='admin*' onEnter={() => {
      window.location = HUGO_ADMIN_ROUTE_ROOT
    }} />
    <Route path='nominate/:id' onEnter={requireAuth} component={Nominate} />
    <Route path='vote'>
      <IndexRoute component={Vote} />
      <Route path=':id' component={Vote} />
    </Route>
    <Redirect from=':id/nominate' to='nominate/:id' />
    <Redirect from=':id/vote' to='vote/:id' />
  </Route>
)

export default class AppRouter extends Route {
  static contextTypes = {
    store: PropTypes.shape({
      dispatch: PropTypes.func.isRequired,
      getState: PropTypes.func.isRequired
    }).isRequired
  }

  get dispatch () {
    return this.context.store.dispatch
  }

  get userEmail () {
    return this.context.store.getState().user.get('email')
  }

  checkAuth = (nextState, replace, callback) => {
    if (this.userEmail) callback()
    else this.dispatch(tryLogin(() => callback()))
  }

  doLogin = ({ location: { query }, params: { email, key, id } }) => {
    const next = query && query.next || (id ? `/hugo/vote/${id}` : null)
    this.dispatch(keyLogin(email, key, next))
  }

  requireAuth = ({ location: { pathname } }, replace) => {
    if (!this.userEmail && pathname !== '/') replace('/')
  }

  scrollUpOnChange = (_, { location: { action } }) => {
    if (action !== 'POP') window.scrollTo(0, 0)
  }

  render () {
    const { history } = this.props
    return (
      <Router history={history}>
        <Route path='/login/:email/:key' onEnter={this.doLogin} />
        <Route path='/login/:email/:key/:id' onEnter={this.doLogin} />
        <Route path='/' component={App} onChange={this.scrollUpOnChange} onEnter={this.checkAuth} >
          <IndexRoute component={Index} />
          <Redirect from='login' to='/' />
          <Redirect from='profile' to='/' />
          {hugoRoutes('hugo', this.requireAuth)}
          <Route path='daypass/:type' component={NewDaypassForm} />
          <Route path='new' component={NewMemberIndex} />
          <Route path='new/:membership' component={NewMemberForm} />
          <Route path='pay' component={Payments} />
          <Route path='pay/:type' component={NewPayment} />
          <Route path='upgrade' onEnter={this.requireAuth}>
            <IndexRoute component={Upgrade} />
            <Route path=':id' component={Upgrade} />
          </Route>
        </Route>
      </Router>
    )
  }
}
